import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { recordAdminAction, type AdminActionTargetType } from "@/lib/admin/admin-actions";
import { applyStrikeForReport, type ApplyStrikeResult } from "@/lib/moderation/apply-strike";
import { restoreAutoHidden } from "@/lib/moderation/auto-hide";
import { findReportTarget } from "@/lib/reports/find-report-target";
import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/reports/constants";
import { createNotification } from "@/lib/notifications/create-notification";
import { graphemeLength } from "@/lib/text/grapheme-length";
import {
  applyModerationEffect,
  isModerationAction,
  planModerationEffect,
  resolveReportStatus,
  shouldNotifyReporter,
} from "@/lib/admin/moderation";
import { REPORT_TARGET_LABELS, type ReportTargetType } from "@/lib/reports/constants";

/** 対応理由（任意メモ）の上限 */
const MAX_NOTE_LENGTH = 1000;

/**
 * F-AD-05 Task1・Task2: 通報対応操作（非公開化／削除／問題なし）＋削除時の通報者への通知
 * 出典: docs/tasks/admin/report-handling/01-report-action-handler.md
 *       docs/tasks/admin/report-handling/02-notification-on-delete.md
 *
 * 対応した管理者・対応日時・対応理由を reports に記録し、status を更新する。
 * 通知は「削除」の場合のみ通報者へ（被通報者へはどの対応でも送らない。匿名性の担保）。
 * 本 API を通報対応の唯一の経路とする（Supabase 管理コンソールからの直接操作はしない運用）。
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = await requireAdminUser(supabase, admin);
  if (!user) {
    return new NextResponse(null, { status: 404 });
  }

  let body: { action?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!isModerationAction(body.action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (graphemeLength(note) > MAX_NOTE_LENGTH) {
    return NextResponse.json({ error: "note_too_long" }, { status: 400 });
  }
  // strike-system Task 2（3.10.6）: 非公開化・削除は本人に理由を通知するので、理由（メモ）を必須にする
  if (body.action !== "no_issue" && note.length === 0) {
    return NextResponse.json({ error: "note_required" }, { status: 400 });
  }

  const { data: report, error: fetchError } = await admin
    .from("reports")
    .select("id, reporter_id, target_type, target_id, status, reason")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  if (!report) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const now = new Date();
  const effect = planModerationEffect(report.target_type as ReportTargetType, body.action);
  // strike-system Task 2: 削除すると持ち主が辿れなくなるので、先に投稿者を確かめておく
  let posterId: string | null = null;
  if (body.action !== "no_issue") {
    try {
      posterId = (await findReportTarget(admin, report.target_type as ReportTargetType, report.target_id))?.ownerId ?? null;
    } catch {
      posterId = null;
    }
  }
  try {
    await applyModerationEffect(admin, effect, report.target_id, now);
    // strike-system Task 3: 「問題なし」なら自動で隠した分（hidden_reason = auto）を公開に戻す
    if (body.action === "no_issue") await restoreAutoHidden(admin, report.target_type as ReportTargetType, report.target_id);
  } catch {
    return NextResponse.json({ error: "action_failed" }, { status: 500 });
  }

  const status = resolveReportStatus(body.action);
  const { error: updateError } = await admin
    .from("reports")
    .update({
      status,
      resolved_by: user.id,
      resolved_at: now.toISOString(),
      resolution_note: note.length > 0 ? note : null,
    })
    .eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  // 要件 3.10.12: 操作の記録（中で要件 7.5 の operation_logs にも残す）
  await recordAdminAction(admin, {
    actorId: user.id,
    action: body.action === "hide" ? "report_hide" : body.action === "delete" ? "report_delete" : "report_no_issue",
    target: {
      type: adminActionTargetOf(report.target_type as ReportTargetType),
      id: report.target_id,
      label: `${REPORT_TARGET_LABELS[report.target_type as ReportTargetType]}（通報 ${id.slice(0, 8)}）`,
    },
    note,
  });

  // strike-system Task 2（3.10.7）: 確定（非公開化・削除）で投稿者に 1 ストライク。本人には理由つきで通知される
  let strike: ApplyStrikeResult | null = null;
  if (body.action !== "no_issue" && posterId) {
    try {
      strike = await applyStrikeForReport(admin, {
        adminId: user.id,
        posterId,
        reportId: id,
        targetType: report.target_type as ReportTargetType,
        reason: report.reason as ReportReason,
        action: body.action,
        targetLabel: `${REPORT_TARGET_LABELS[report.target_type as ReportTargetType]}（${REPORT_REASON_LABELS[report.reason as ReportReason]}）`,
        note,
        now,
      });
    } catch (error) {
      // ストライクが付かなくても対応自体は済んでいる。記録に残して続ける
      console.error("[admin] ストライクを付けられませんでした:", error instanceof Error ? error.message : error);
    }
  }

  // Task2: 削除の場合のみ通報者へ通知。被通報者へは送らない
  if (shouldNotifyReporter(body.action)) {
    await createNotification(admin, {
      recipientId: report.reporter_id,
      actorId: null,
      type: "report_resolved",
      relatedId: id,
    });
  }

  return NextResponse.json({
    reportId: id,
    status,
    resolvedAt: now.toISOString(),
    strike: strike ? { activeCount: strike.activeCount, measure: strike.measure, severe: strike.severe } : null,
  });
}

/** 通報の対象種別 → 操作の記録の対象種別（感想・写真は投稿に、アルバムは trip に寄せる） */
function adminActionTargetOf(targetType: ReportTargetType): AdminActionTargetType {
  switch (targetType) {
    case "post":
    case "post_photo":
    case "post_review":
      return "post";
    case "comment":
      return "comment";
    case "user":
      return "user";
    case "spot":
      return "spot";
    case "trip":
      return "trip";
  }
}
