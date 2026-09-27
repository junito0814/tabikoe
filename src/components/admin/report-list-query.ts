import { REPORT_REASONS, REPORT_TARGET_TYPES, type ReportReason, type ReportTargetType } from "@/lib/reports/constants";
import { REPORT_STATUSES, type ReportStatus } from "@/lib/admin/report-filters";

const REPORT_STATUS_VALUES = new Set<string>(REPORT_STATUSES);
const REASON_VALUES = new Set<string>(REPORT_REASONS);
const TARGET_VALUES = new Set<string>(REPORT_TARGET_TYPES);

/**
 * F-AD-04 Task2: 絞り込みUIの状態 → GET /api/admin/reports のクエリ
 * 出典: docs/tasks/admin/report-list/02-report-list-ui.md
 */
export interface ReportListState {
  /** "open" は未対応（未確認＋確認中） */
  status: ReportStatus | "open" | "";
  /** ダッシュボードから来たときだけ入る（画面には出さない） */
  targetId?: string;
  sort?: "newest" | "oldest";
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
  if (state.targetId) params.set("target_id", state.targetId);
  if (state.sort === "oldest") params.set("sort", "oldest");
  // 日付のみの入力は、from は当日0時、to は当日の終わり（翌日0時の直前）として送る
  if (state.from) params.set("from", `${state.from}T00:00:00`);
  if (state.to) params.set("to", `${state.to}T23:59:59.999`);
  if (offset > 0) params.set("offset", String(offset));
  return params;
}

/**
 * URL のクエリ → 画面の初期状態（ダッシュボードのリンク `?status=open&sort=oldest` を受ける。純粋関数）
 * 不正な値は空にする。日付は YYYY-MM-DD の部分だけ使う
 */
export function reportListStateFromParams(params: URLSearchParams): ReportListState {
  const status = params.get("status") ?? "";
  const reason = params.get("reason") ?? "";
  const targetType = params.get("target_type") ?? "";
  const targetId = params.get("target_id") ?? "";
  return {
    status: status === "open" || REPORT_STATUS_VALUES.has(status) ? (status as ReportListState["status"]) : "",
    reason: REASON_VALUES.has(reason) ? (reason as ReportReason) : "",
    targetType: TARGET_VALUES.has(targetType) ? (targetType as ReportTargetType) : "",
    targetId: /^[0-9a-f-]{36}$/i.test(targetId) ? targetId : undefined,
    sort: params.get("sort") === "oldest" ? "oldest" : undefined,
    from: (params.get("from") ?? "").slice(0, 10),
    to: (params.get("to") ?? "").slice(0, 10),
  };
}
