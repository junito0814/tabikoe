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
 *
 * 【初心者向け】URL クエリ → 条件（parseReportFilters）→ where 句の配列（buildReportWhereClauses）→ Supabase クエリ
 * （listReports）の 3 段。前 2 つは DB に触らない純粋関数なので単体テストで検証し、最後だけ結合テストの対象にする。
 * `count: "exact"` は総件数も一緒に返してもらう指定で、「もっと見る」を出すかの判断（nextOffset）に使う。
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

/** 「未対応」＝未確認＋確認中（3.8.1）。ダッシュボードの入口とメニューの件数が使う */
export const OPEN_REPORT_STATUSES: readonly ReportStatus[] = ["unconfirmed", "in_review"];

export interface ReportFilters {
  /** "open" は未確認＋確認中のまとめ（admin-shell-dashboard Task 2） */
  status: ReportStatus | "open" | null;
  /** 特定の対象への通報だけ（ダッシュボードの「通報が集中している対象」から） */
  targetId: string | null;
  /** 並び。既定は新しい順。"oldest" は古い順（未対応を溜めないため、ダッシュボードから来たとき） */
  /**
   * #892（2026-10-11・決定事項 89）: 既定は **urgency**（Jev の緊急度が高い順）。
   * 「古い通報を放置しない」という oldest の目的は、一覧の上の 1 行で守る。
   */
  sort: "urgency" | "newest" | "oldest";
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
  const targetId = searchParams.get("target_id") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  return {
    status: status === "open" ? "open" : (REPORT_STATUSES as readonly string[]).includes(status) ? (status as ReportStatus) : null,
    targetId: /^[0-9a-f-]{36}$/i.test(targetId) ? targetId : null,
    sort: parseSort(searchParams.get("sort")),
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
  | { op: "in"; column: string; values: readonly string[] }
  | { op: "gte"; column: string; value: string }
  | { op: "lte"; column: string; value: string };

export function buildReportWhereClauses(filters: ReportFilters): WhereClause[] {
  const clauses: WhereClause[] = [];
  if (filters.status === "open") clauses.push({ op: "in", column: "status", values: OPEN_REPORT_STATUSES });
  else if (filters.status) clauses.push({ op: "eq", column: "status", value: filters.status });
  if (filters.targetId) clauses.push({ op: "eq", column: "target_id", value: filters.targetId });
  if (filters.reason) clauses.push({ op: "eq", column: "reason", value: filters.reason });
  if (filters.targetType) clauses.push({ op: "eq", column: "target_type", value: filters.targetType });
  if (filters.from) clauses.push({ op: "gte", column: "created_at", value: filters.from });
  if (filters.to) clauses.push({ op: "lte", column: "created_at", value: filters.to });
  return clauses;
}

/** URL のクエリ → 並び順。知らない値は既定に倒す（純粋関数。約束 13） */
export function parseSort(value: string | null): ReportFilters["sort"] {
  if (value === "oldest" || value === "newest" || value === "urgency") return value;
  return "urgency";
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
  /** #892: Jev の見立て。呼べなかった通報は null のまま（画面では「―」） */
  jev: { urgency: number | null; reason: string | null; confidence: number | null } | null;
}

export async function listReports(
  admin: SupabaseClient,
  filters: ReportFilters,
  offset: number,
  limit: number = REPORTS_PAGE_SIZE
): Promise<{ reports: ReportListItem[]; nextOffset: number | null }> {
  let query = admin
    .from("reports")
    .select(
      "id, target_type, target_id, reason, detail, status, created_at, resolved_at, resolution_note, jev_urgency, jev_reason, jev_confidence",
      { count: "exact" }
    )
    .range(offset, offset + limit - 1);

  /*
   * #892: 緊急度が高い順。**判定できなかった通報を先頭に出さない**ため nullsFirst: false。
   * 緊急度が同じ（または両方 null）のときは、新しい順で並べる。
   */
  if (filters.sort === "urgency") {
    query = query.order("jev_urgency", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: filters.sort === "oldest" });
  }

  for (const clause of buildReportWhereClauses(filters)) {
    if (clause.op === "eq") query = query.eq(clause.column, clause.value);
    else if (clause.op === "in") query = query.in(clause.column, [...clause.values]);
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
    jev:
      row.jev_urgency === null && row.jev_reason === null
        ? null
        : {
            urgency: row.jev_urgency === null ? null : Number(row.jev_urgency),
            reason: (row.jev_reason as string | null) ?? null,
            confidence: row.jev_confidence === null ? null : Number(row.jev_confidence),
          },
    resolvedAt: row.resolved_at as string | null,
    resolutionNote: row.resolution_note as string | null,
  }));
  const total = count ?? 0;
  return { reports, nextOffset: offset + reports.length < total ? offset + reports.length : null };
}
