import { REPORT_REASONS, REPORT_TARGET_TYPES, type ReportReason, type ReportTargetType } from "@/lib/reports/constants";
import { REPORT_STATUSES, type ReportStatus } from "@/lib/admin/report-filters";

const REPORT_STATUS_VALUES = new Set<string>(REPORT_STATUSES);
const REASON_VALUES = new Set<string>(REPORT_REASONS);
const TARGET_VALUES = new Set<string>(REPORT_TARGET_TYPES);
/** #1013: 並びに使える値。サーバー側の parseSort と同じ 3 つ */
const SORT_VALUES = new Set<string>(["urgency", "newest", "oldest"]);

/**
 * F-AD-04 Task2: 絞り込みUIの状態 → GET /api/admin/reports のクエリ
 * 出典: docs/tasks/admin/report-list/02-report-list-ui.md
 */
export interface ReportListState {
  /** "open" は未対応（未確認＋確認中） */
  status: ReportStatus | "open" | "";
  /** ダッシュボードから来たときだけ入る（画面には出さない） */
  targetId?: string;
  /**
   * 並び。省略は「指定なし」＝サーバー側の既定（urgency）。
   *
   * #1013（2026-10-24）: ~~`"newest" | "oldest"`~~ に `"urgency"` を足した。
   * #892 で**省略時の既定が newest から urgency に変わった**のに、ここが追いついて
   * いなかったため、「新しい順」を選んでも `sort` がクエリに乗らず、既定（urgency）に
   * 落ちていた（＝新しい順が効かない）。
   */
  sort?: "urgency" | "newest" | "oldest";
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
  /*
   * #1013: urgency 以外は必ずクエリに入れる。
   *
   * 【初心者向け】省略＝既定（urgency）なので、**newest を省略すると urgency になります**。
   * 「既定と同じものは省く」という書き方は、既定が変わった瞬間に壊れます。
   */
  if (state.sort === "oldest" || state.sort === "newest") params.set("sort", state.sort);
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
    // #1013: oldest だけでなく newest・urgency も読む（知らない値は「指定なし」）
    sort: SORT_VALUES.has(params.get("sort") ?? "") ? (params.get("sort") as ReportListState["sort"]) : undefined,
    from: (params.get("from") ?? "").slice(0, 10),
    to: (params.get("to") ?? "").slice(0, 10),
  };
}
