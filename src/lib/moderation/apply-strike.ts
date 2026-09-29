import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAdminAction } from "@/lib/admin/admin-actions";
import { createNotification } from "@/lib/notifications/create-notification";
import { REPORT_TARGET_LABELS, type ReportReason, type ReportTargetType } from "@/lib/reports/constants";
import { loadModerationSettings } from "@/lib/moderation/settings";
import { provisionallySuspend } from "@/lib/moderation/suspend";
import { REPORT_REASON_LABELS } from "@/lib/reports/constants";
import {
  activeStrikeCount,
  isSevereReason,
  measureForStrikeCount,
  restrictionUntil,
  strikeExpiresAt,
  type Measure,
  type StrikeLike,
} from "@/lib/moderation/strike-rules";

/**
 * strike-system Task 2: 通報対応の確定（非公開化／削除）でストライクを付ける
 * 出典: docs/tasks/safety/strike-system/02-strike-on-resolve.md
 *       要件定義書 3.10.7「ストライク制」・3.9.1「本人への通知」
 *
 * 【初心者向け】流れは 1) strikes に 1 行 → 2) 有効な数を数える → 3) 段階に応じて posting_restricted_until を進める
 * → 4) 本人に通知（理由・対象・措置・解除日）→ 5) 操作の記録。通報者は本人に伝えない（通知に載せない）。
 * 「5 個で仮停止」「個人情報・なりすましは 1 回で仮停止」は、判定のあと provisionallySuspend（suspend.ts）を呼ぶ（Task 4）。
 */
export interface ApplyStrikeInput {
  adminId: string;
  posterId: string;
  reportId: string;
  targetType: ReportTargetType;
  reason: ReportReason;
  action: "hide" | "delete";
  /** 対象の言い方（例: 感想「…」）。無ければ種別名 */
  targetLabel?: string | null;
  note: string;
  now?: Date;
}

export interface ApplyStrikeResult {
  strikeId: string;
  activeCount: number;
  measure: Measure;
  /** 1 回で仮停止にする重大な違反 */
  severe: boolean;
  postingRestrictedUntil: string | null;
  /** strike-system Task 4: このストライクで仮停止になったか */
  suspended: boolean;
}

export async function applyStrikeForReport(admin: SupabaseClient, input: ApplyStrikeInput): Promise<ApplyStrikeResult> {
  const now = input.now ?? new Date();
  const settings = await loadModerationSettings(admin);
  const targetLabel = input.targetLabel?.trim() || REPORT_TARGET_LABELS[input.targetType];

  // 1) ストライクを 1 行
  const { data: inserted, error: insertError } = await admin
    .from("strikes")
    .insert({
      user_id: input.posterId,
      report_id: input.reportId,
      reason: input.reason,
      action: input.action,
      target_label: targetLabel,
      created_by: input.adminId,
      created_at: now.toISOString(),
      expires_at: strikeExpiresAt(now, settings).toISOString(),
    })
    .select("id")
    .single();
  if (insertError || !inserted) throw insertError ?? new Error("strike insert failed");

  // 2) 有効な数
  const { data: rows, error: rowsError } = await admin.from("strikes").select("created_at, expires_at, revoked_at").eq("user_id", input.posterId);
  if (rowsError) throw rowsError;
  const strikes: StrikeLike[] = ((rows ?? []) as { created_at: string; expires_at: string; revoked_at: string | null }[]).map((r) => ({
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
  }));
  const activeCount = activeStrikeCount(strikes, now);
  const measure = measureForStrikeCount(activeCount, settings);
  const severe = isSevereReason(input.reason);

  // 3) 投稿禁止（既にもっと先まで止まっていれば縮めない）
  let postingRestrictedUntil: string | null = null;
  const until = restrictionUntil(measure, now);
  if (until) {
    const { data: current } = await admin.from("users").select("posting_restricted_until").eq("id", input.posterId).maybeSingle();
    const existing = (current?.posting_restricted_until as string | null | undefined) ?? null;
    postingRestrictedUntil = existing && new Date(existing).getTime() > until.getTime() ? existing : until.toISOString();
    const { error } = await admin.from("users").update({ posting_restricted_until: postingRestrictedUntil }).eq("id", input.posterId);
    if (error) throw error;
  }

  // 4) 本人へ（通報者は含めない）
  await createNotification(admin, { recipientId: input.posterId, actorId: null, type: "moderation_action", relatedId: inserted.id as string });

  // 5) 操作の記録
  await recordAdminAction(admin, {
    actorId: input.adminId,
    action: "strike_add",
    target: { type: "user", id: input.posterId, label: `${targetLabel}（有効 ${activeCount - 1} → ${activeCount}）` },
    note: input.note,
  });

  // 6) strike-system Task 4: 有効 5 個、または重大な違反なら仮停止（確認待ち）
  let suspended = false;
  if (measure.kind === "suspend" || severe) {
    const reason = severe
      ? `重大な違反（${REPORT_REASON_LABELS[input.reason]}）のため 1 回で仮停止`
      : `有効なストライクが ${activeCount} 個になったため仮停止`;
    suspended = (await provisionallySuspend(admin, { userId: input.posterId, reason, now })).suspended;
  }

  return { strikeId: inserted.id as string, activeCount, measure, severe, postingRestrictedUntil, suspended };
}
