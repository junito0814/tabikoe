import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAdminAction } from "@/lib/admin/admin-actions";
import { notifyAdmins } from "@/lib/notifications/notify-admins";
import { OPEN_REPORT_STATUSES } from "@/lib/admin/report-filters";
import type { ReportTargetType } from "@/lib/reports/constants";
import { loadModerationSettings } from "./settings";
import { countReliableReporters, shouldAutoHide } from "./strike-rules";

/**
 * strike-system Task 3: 異なる通報者 3 人で投稿・コメントを自動的に非公開にする
 * 出典: docs/tasks/safety/strike-system/03-auto-hide.md
 *       要件定義書 3.10.8「自動で行う対応」
 *
 * 【初心者向け】通報を受け付けた直後に呼ぶ。同じ対象への未処理の通報を集め、通報者ごとの「直近 90 日の問題なし」を
 * 数えて信頼度の低い通報者を除き、異なる通報者が 3 人以上なら hidden_at を入れて hidden_reason = 'auto' にする。
 * 隠したら管理者に通知し、操作の記録に「自動」で残す。判断そのもの（shouldAutoHide）は strike-rules.ts。
 * 対象は投稿（post／post_review は同じ投稿なのでまとめる）とコメントだけ。写真・ユーザー・スポット・アルバムは対象外。
 */
export type AutoHideTable = "posts" | "comments";

/** 通報の対象種別 → 自動非公開の対象（純粋関数）。対象外なら null */
export function autoHideTargetOf(targetType: ReportTargetType): { table: AutoHideTable; targetTypes: ReportTargetType[] } | null {
  if (targetType === "post" || targetType === "post_review") return { table: "posts", targetTypes: ["post", "post_review"] };
  if (targetType === "comment") return { table: "comments", targetTypes: ["comment"] };
  return null;
}

export async function evaluateAutoHide(
  admin: SupabaseClient,
  input: { targetType: ReportTargetType; targetId: string; now?: Date }
): Promise<{ hidden: boolean; reporters: number }> {
  const target = autoHideTargetOf(input.targetType);
  if (!target) return { hidden: false, reporters: 0 };
  const now = input.now ?? new Date();

  const settings = await loadModerationSettings(admin);
  const { data: openRows, error } = await admin
    .from("reports")
    .select("reporter_id, reason")
    .eq("target_id", input.targetId)
    .in("target_type", target.targetTypes)
    .in("status", [...OPEN_REPORT_STATUSES]);
  if (error) throw error;
  const reports = ((openRows ?? []) as { reporter_id: string; reason: string }[]).map((r) => ({ reporterId: r.reporter_id, reason: r.reason }));
  const reporterIds = [...new Set(reports.map((r) => r.reporterId))];
  if (reporterIds.length < settings.autoHideReporters) return { hidden: false, reporters: reporterIds.length };

  // 通報者ごとの「直近 90 日の問題なし」
  const since = new Date(now.getTime() - 90 * 86400000).toISOString();
  const { data: noIssueRows, error: noIssueError } = await admin
    .from("reports")
    .select("reporter_id")
    .in("reporter_id", reporterIds)
    .eq("status", "no_issue")
    .gte("created_at", since);
  if (noIssueError) throw noIssueError;
  const noIssueCount = new Map<string, number>();
  for (const r of (noIssueRows ?? []) as { reporter_id: string }[]) noIssueCount.set(r.reporter_id, (noIssueCount.get(r.reporter_id) ?? 0) + 1);

  const reporters = countReliableReporters(reports, noIssueCount, settings);
  if (!shouldAutoHide(reports, noIssueCount, settings)) return { hidden: false, reporters };

  // まだ隠れていない行だけ隠す（既に管理者が非公開化していれば触らない）
  const { data: updated, error: updateError } = await admin
    .from(target.table)
    .update({ hidden_at: now.toISOString(), hidden_reason: "auto" })
    .eq("id", input.targetId)
    .is("hidden_at", null)
    .select("id");
  if (updateError) throw updateError;
  if (!updated || updated.length === 0) return { hidden: false, reporters };

  const reasons = summarizeReasons(reports.map((r) => r.reason));
  await notifyAdmins(admin, { type: "admin_auto_hidden", relatedId: input.targetId });
  await recordAdminAction(admin, {
    actorId: null,
    action: "auto_hide",
    target: { type: target.table === "posts" ? "post" : "comment", id: input.targetId, label: target.table === "posts" ? "投稿" : "コメント" },
    note: `異なる通報者 ${reporters} 人（${reasons}）`,
  });
  return { hidden: true, reporters };
}

/** 理由の内訳を「個人情報×2・スパム×1」の形に（純粋関数） */
export function summarizeReasons(reasons: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const r of reasons) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason, n]) => `${reason}×${n}`)
    .join("・");
}

/** 「問題なし」で戻す。自動で隠した行（hidden_reason = 'auto'）だけを公開に戻す */
export async function restoreAutoHidden(admin: SupabaseClient, targetType: ReportTargetType, targetId: string): Promise<boolean> {
  const target = autoHideTargetOf(targetType);
  if (!target) return false;
  const { data, error } = await admin
    .from(target.table)
    .update({ hidden_at: null, hidden_reason: null })
    .eq("id", targetId)
    .eq("hidden_reason", "auto")
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
