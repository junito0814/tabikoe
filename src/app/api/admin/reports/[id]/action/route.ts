import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { recordOperation } from "@/lib/logs/record-operation";
import { createNotification } from "@/lib/notifications/create-notification";
import { graphemeLength } from "@/lib/text/grapheme-length";
import {
  applyModerationEffect,
  isModerationAction,
  planModerationEffect,
  resolveReportStatus,
  shouldNotifyReporter,
} from "@/lib/admin/moderation";
import type { ReportTargetType } from "@/lib/reports/constants";

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

  const { data: report, error: fetchError } = await admin
    .from("reports")
    .select("id, reporter_id, target_type, target_id, status")
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
  try {
    await applyModerationEffect(admin, effect, report.target_id, now);
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

  // 要件7.5: 管理者による対応操作
  await recordOperation(admin, {
    actionType: "admin_action",
    userId: user.id,
    targetId: id,
    detail: { action: body.action, targetType: report.target_type, targetId: report.target_id, status },
  });

  // Task2: 削除の場合のみ通報者へ通知。被通報者へは送らない
  if (shouldNotifyReporter(body.action)) {
    await createNotification(admin, {
      recipientId: report.reporter_id,
      actorId: null,
      type: "report_resolved",
      relatedId: id,
    });
  }

  return NextResponse.json({ reportId: id, status, resolvedAt: now.toISOString() });
}
