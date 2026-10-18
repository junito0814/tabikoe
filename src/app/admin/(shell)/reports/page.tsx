import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { ReportListScreen } from "@/components/admin/ReportListScreen";
import { listReports, parseReportFilters } from "@/lib/admin/report-filters";
import { buildReportListParams, reportListStateFromParams } from "@/components/admin/report-list-query";

/*
 * #901: 器を静的に作る対象から外す（instant = false）。
 *
 * 【初心者向け】管理画面は**パソコン前提・ログイン必須**で、開くのは運営だけです。
 * 器を先に配ってもうれしい人がいないうえ、ダッシュボードは `new Date()` など
 * **毎回変わるもの**を素で読んでいます。利用者向けの画面を先に進めるため、ここは外します。
 * 外しても動きは今までどおりです（毎回サーバーで描く）。
 */
export const instant = false;

/**
 * SC-18 通報一覧画面
 * 出典: docs/tasks/admin/report-list/02-report-list-ui.md
 *
 * アクセス制御は src/proxy.ts（/admin 配下の is_admin 判定・404）に委ねる。
 */
export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  // admin-shell-dashboard Task 2: ダッシュボードのリンク（?status=open&sort=oldest など）を初期の絞り込みにする
  const raw = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") raw.set(key, value);
  }
  const initialState = reportListStateFromParams(raw);
  let initialPage: Awaited<ReturnType<typeof listReports>> | null = null;
  try {
    initialPage = await listReports(createAdminClient(), parseReportFilters(buildReportListParams(initialState, 0)), 0);
  } catch {
    initialPage = null;
  }

  if (!initialPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  return <ReportListScreen initialPage={initialPage} initialState={initialState} />;
}
