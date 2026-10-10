import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { isWithinRateLimit } from "@/lib/rate-limit/check-rate-limit";
import { recordOperation } from "@/lib/logs/record-operation";
import { notifyAdmins } from "@/lib/notifications/notify-admins";
import { evaluateAutoHide } from "@/lib/moderation/auto-hide";
import { validateReportInput } from "@/lib/reports/validate-report-input";
import { findReportTarget } from "@/lib/reports/find-report-target";
import {
  REPORT_RATE_LIMIT_MAX_ATTEMPTS,
  REPORT_RATE_LIMIT_WINDOW_SECONDS,
} from "@/lib/reports/constants";

/**
 * F-SF-01 Task3・Task4: 通報の作成
 * 出典: docs/tasks/safety/reporting/03-report-creation-handler.md
 *       docs/tasks/safety/reporting/04-report-rate-limiting.md
 *
 * 通報後も対象の表示状態は変えない（status='unconfirmed' で保存するのみ、3.8.1）。
 * 対応状態の更新・通報者への通知は F-AD-05 の範囲。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Task4: 1ユーザーにつき1日20件まで（7.3）
  let allowed: boolean;
  try {
    allowed = await isWithinRateLimit(
      admin,
      user.id,
      "report_create",
      REPORT_RATE_LIMIT_WINDOW_SECONDS,
      REPORT_RATE_LIMIT_MAX_ATTEMPTS
    );
  } catch {
    return NextResponse.json({ error: "rate_limit_unavailable" }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const validation = validateReportInput(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { targetType, targetId, reason, detail } = validation.fields;

  // FKが無いため、対象の実在をアプリ層で確認する
  let target;
  try {
    target = await findReportTarget(admin, targetType, targetId);
  } catch {
    return NextResponse.json({ error: "target_lookup_failed" }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: "target_not_found" }, { status: 404 });
  }
  if (target.ownerId === user.id) {
    return NextResponse.json({ error: "cannot_report_self" }, { status: 400 });
  }

  // RLS（reports_reporter_insert）に従わせるためユーザー権限で作成する
  const { data: report, error: insertError } = await supabase
    .from("reports")
    .insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      detail,
    })
    .select("id")
    .single();

  if (insertError) {
    // 一意制約違反 = 同一対象への重複通報
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "already_reported" }, { status: 409 });
    }
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  // 要件7.5: 通報
  await recordOperation(admin, {
    actionType: "report_create",
    userId: user.id,
    targetId: report.id,
    detail: { targetType, reason },
  });

  // admin-shell-dashboard Task 4（要件 3.9.1）: 管理者全員に「新しい通報」を知らせる（通報者が管理者なら本人には送らない）
  await notifyAdmins(admin, { type: "admin_report", relatedId: report.id, actorId: user.id });

  // strike-system Task 3（要件 3.10.8）: 異なる通報者 3 人で自動的に非公開（確認待ち）。失敗しても通報の受付は成功にする
  try {
    await evaluateAutoHide(admin, { targetType, targetId });
  } catch (error) {
    // #895: Next.js の内部的な合図（redirect / notFound など）は、記録する前に投げ直す。
    // 握りつぶすと転送が黙って効かなくなる。API の口でも決まりを揃える
    unstable_rethrow(error);
    console.error("[reports] 自動非公開の判定に失敗しました:", error instanceof Error ? error.message : error);
  }

  return NextResponse.json({ reportId: report.id }, { status: 201 });
}
