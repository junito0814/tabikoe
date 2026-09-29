import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { ReportListScreen } from "@/components/admin/ReportListScreen";
import { listReports, parseReportFilters } from "@/lib/admin/report-filters";
import { buildReportListParams, reportListStateFromParams } from "@/components/admin/report-list-query";

// 管理データは毎リクエスト取得する（ビルド時に固定しない）
export const dynamic = "force-dynamic";

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
