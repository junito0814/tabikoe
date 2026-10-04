import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  OPERATION_LOG_RETENTION_DAYS,
  isAuthorizedCronRequest,
  operationLogCutoff,
} from "@/lib/admin/operation-log-retention";

/**
 * GET /api/cron/purge-operation-logs — 90 日を超えた操作ログを消す（#714）
 * 出典: 要件定義書 7.5「運用・保守」、個人情報保護方針 1.1「5. 保存期間」
 *
 * 【初心者向け】`vercel.json` の `crons` に書いた時刻に Vercel が自分で呼ぶ。
 * 1 日 1 回、日本時間の 3 時（UTC 18 時）。人が開く画面ではない。
 *
 * 消すのは `operation_logs` だけ。`admin_actions`（運営者の対応の記録）は消さない。
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = operationLogCutoff();
  const { error, count } = await createAdminClient()
    .from("operation_logs")
    .delete({ count: "exact" })
    .lt("created_at", cutoff.toISOString());

  if (error) {
    // 失敗しても次の日にまた走る。アプリの他の処理は止めない
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ deleted: count ?? 0, olderThanDays: OPERATION_LOG_RETENTION_DAYS, cutoff: cutoff.toISOString() });
}
