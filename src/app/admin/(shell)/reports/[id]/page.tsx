import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { ReportDetailScreen } from "@/components/admin/ReportDetailScreen";
import { getReportDetail, type ReportDetail } from "@/lib/admin/report-detail";
import { loadReportModerationContext, type ReportModerationContext } from "@/lib/admin/report-context";

/**
 * SC-18 通報詳細・対応操作
 * 出典: docs/tasks/admin/report-handling/03-report-action-ui.md
 */
export default async function AdminReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let report: ReportDetail | null = null;
  let context: ReportModerationContext | null = null;
  let failed = false;
  try {
    const admin = createAdminClient();
    report = await getReportDetail(admin, id);
    // strike-system Task 2: 判断の材料。取れなくても詳細は出す
    if (report) context = await loadReportModerationContext(admin, report).catch(() => null);
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }
  if (!report) {
    notFound();
  }

  return <ReportDetailScreen report={report} context={context} />;
}
