import type { ReportTargetType } from "@/lib/reports/constants";

/**
 * SC-11（/report）への遷移URLを組み立てる。
 * 各画面の通報導線はこの関数を通し、クエリ名の揺れを防ぐ。
 */
export function buildReportHref({
  targetType,
  targetId,
  returnTo,
}: {
  targetType: ReportTargetType;
  targetId: string;
  returnTo?: string;
}): string {
  const params = new URLSearchParams({ targetType, targetId });
  if (returnTo) params.set("returnTo", returnTo);
  return `/report?${params.toString()}`;
}
