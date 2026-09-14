import type { ReportReason, ReportTargetType } from "@/lib/reports/constants";
import type { ReportStatus } from "@/lib/admin/report-filters";

/**
 * F-AD-04 Task2: 絞り込みUIの状態 → GET /api/admin/reports のクエリ
 * 出典: docs/tasks/admin/report-list/02-report-list-ui.md
 */
export interface ReportListState {
  status: ReportStatus | "";
  reason: ReportReason | "";
  targetType: ReportTargetType | "";
  /** YYYY-MM-DD */
  from: string;
  to: string;
}

export const EMPTY_REPORT_LIST_STATE: ReportListState = { status: "", reason: "", targetType: "", from: "", to: "" };

export function buildReportListParams(state: ReportListState, offset: number): URLSearchParams {
  const params = new URLSearchParams();
  if (state.status) params.set("status", state.status);
  if (state.reason) params.set("reason", state.reason);
  if (state.targetType) params.set("target_type", state.targetType);
  // 日付のみの入力は、from は当日0時、to は当日の終わり（翌日0時の直前）として送る
  if (state.from) params.set("from", `${state.from}T00:00:00`);
  if (state.to) params.set("to", `${state.to}T23:59:59.999`);
  if (offset > 0) params.set("offset", String(offset));
  return params;
}
