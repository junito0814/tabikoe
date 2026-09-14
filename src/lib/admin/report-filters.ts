import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REPORT_REASONS,
  REPORT_TARGET_TYPES,
  type ReportReason,
  type ReportTargetType,
} from "@/lib/reports/constants";

/**
 * F-AD-04 Task1: 通報一覧の絞り込み
 * 出典: docs/tasks/admin/report-list/01-report-list-handler.md
 *       要件定義書3.8.1（対応状態）・3.10.4
 */
export const REPORT_STATUSES = [
  "unconfirmed",
  "in_review",
  "resolved_hidden",
  "resolved_deleted",
  "no_issue",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  unconfirmed: "未確認",
  in_review: "確認中",
  resolved_hidden: "対応済み（非公開化）",
  resolved_deleted: "対応済み（削除）",
  no_issue: "問題なし",
};

export interface ReportFilters {
  status: ReportStatus | null;
  reason: ReportReason | null;
  targetType: ReportTargetType | null;
  /** 通報日時の範囲（ISO 8601）。from は含む、to は翌日0時未満で扱うため呼び出し側で丸めない */
  from: string | null;
  to: string | null;
}

export const REPORTS_PAGE_SIZE = 50;

/** クエリ文字列 → 絞り込み条件。不正な値は無視する（単体テストの対象） */
export function parseReportFilters(searchParams: URLSearchParams): ReportFilters {
  const status = searchParams.get("status") ?? "";
  const reason = searchParams.get("reason") ?? "";
  const targetType = searchParams.get("target_type") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  return {
    status: (REPORT_STATUSES as readonly string[]).includes(status) ? (status as ReportStatus) : null,
    reason: (REPORT_REASONS as readonly string[]).includes(reason) ? (reason as ReportReason) : null,
    targetType: (REPORT_TARGET_TYPES as readonly string[]).includes(targetType)
      ? (targetType as ReportTargetType)
      : null,
    from: from && !Number.isNaN(Date.parse(from)) ? new Date(from).toISOString() : null,
    to: to && !Number.isNaN(Date.parse(to)) ? new Date(to).toISOString() : null,
  };
}

/**
 * 絞り込み条件 → PostgREST の where 条件の列。
 * クエリビルダーに依存しない形で組み立て、単体テストで検証できるようにする。
 */
export type WhereClause =
  | { op: "eq"; column: string; value: string }
  | { op: "gte"; column: string; value: string }
  | { op: "lte"; column: string; value: string };

export function buildReportWhereClauses(filters: ReportFilters): WhereClause[] {
  const clauses: WhereClause[] = [];
  if (filters.status) clauses.push({ op: "eq", column: "status", value: filters.status });
  if (filters.reason) clauses.push({ op: "eq", column: "reason", value: filters.reason });
  if (filters.targetType) clauses.push({ op: "eq", column: "target_type", value: filters.targetType });
  if (filters.from) clauses.push({ op: "gte", column: "created_at", value: filters.from });
  if (filters.to) clauses.push({ op: "lte", column: "created_at", value: filters.to });
  return clauses;
}

export interface ReportListItem {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail: string | null;
  status: ReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

export async function listReports(
  admin: SupabaseClient,
  filters: ReportFilters,
  offset: number,
  limit: number = REPORTS_PAGE_SIZE
): Promise<{ reports: ReportListItem[]; nextOffset: number | null }> {
  let query = admin
    .from("reports")
    .select("id, target_type, target_id, reason, detail, status, created_at, resolved_at, resolution_note", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  for (const clause of buildReportWhereClauses(filters)) {
    if (clause.op === "eq") query = query.eq(clause.column, clause.value);
    else if (clause.op === "gte") query = query.gte(clause.column, clause.value);
    else query = query.lte(clause.column, clause.value);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const reports = (data ?? []).map((row) => ({
    id: row.id as string,
    targetType: row.target_type as ReportTargetType,
    targetId: row.target_id as string,
    reason: row.reason as ReportReason,
    detail: row.detail as string | null,
    status: row.status as ReportStatus,
    createdAt: row.created_at as string,
    resolvedAt: row.resolved_at as string | null,
    resolutionNote: row.resolution_note as string | null,
  }));
  const total = count ?? 0;
  return { reports, nextOffset: offset + reports.length < total ? offset + reports.length : null };
}
