import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { ReportDetailScreen } from "@/components/admin/ReportDetailScreen";
import { getReportDetail, type ReportDetail } from "@/lib/admin/report-detail";
import { loadReportModerationContext, type ReportModerationContext } from "@/lib/admin/report-context";

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
