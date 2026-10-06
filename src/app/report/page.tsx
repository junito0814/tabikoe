import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { isReportTargetType, isUuid } from "@/lib/reports/validate-report-input";
import { ReportForm } from "@/components/reports/ReportForm";
import { buildReportHref } from "@/components/reports/report-href";

// #785: ブラウザのタブ名（「報告 | タビコエ」）
export const metadata = { title: "報告" };

/**
 * SC-11 通報画面
 * 出典: docs/tasks/safety/reporting/02-report-screen-ui.md
 *
 * 各画面の通報導線（ReportLink）から `?targetType=&targetId=&returnTo=` で対象を引き継ぐ。
 * 通報はログイン必須（SC-11 は未ログイン閲覧不可、4.1）。
 */
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ targetType?: string; targetId?: string; returnTo?: string }>;
}) {
  const { targetType, targetId, returnTo } = await searchParams;

  if (!isReportTargetType(targetType) || !isUuid(targetId)) {
    notFound();
  }

  // オープンリダイレクト防止: アプリ内の絶対パスのみ許可
  const safeReturnTo = returnTo && /^\/(?!\/)/.test(returnTo) ? returnTo : "/";

  const supabase = await createClient();
  await requireUserOrRedirect(
    supabase,
    buildReportHref({ targetType, targetId, returnTo: safeReturnTo })
  );

  return <ReportForm targetType={targetType} targetId={targetId} returnTo={safeReturnTo} />;
}
