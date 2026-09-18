"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import {
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  REPORT_TARGET_LABELS,
  REPORT_TARGET_TYPES,
  type ReportReason,
  type ReportTargetType,
} from "@/lib/reports/constants";
import {
  REPORT_STATUS_LABELS,
  REPORT_STATUSES,
  type ReportListItem,
  type ReportStatus,
} from "@/lib/admin/report-filters";
import { buildReportListParams, EMPTY_REPORT_LIST_STATE, type ReportListState } from "./report-list-query";

export type FetchReports = (params: URLSearchParams) => Promise<{ reports: ReportListItem[]; nextOffset: number | null }>;

/**
 * F-AD-04 Task2: 通報一覧画面（SC-18・一覧部分）
 * 出典: docs/tasks/admin/report-list/02-report-list-ui.md
 *
 * 対応状態・通報理由・対象種別・通報日時で絞り込む。各行から通報詳細（対応操作、F-AD-05）へ遷移する。
 *
 * 【初心者向け】絞り込みフォームは `draft`（入力中の条件）と `applied`（検索に使った条件）を分けて持つ。
 * 分けないと、入力欄を触るたびに検索が走ったり、「もっと見る」が入力途中の条件で続きを取ったりしてしまう。
 * 「絞り込む」で draft → applied にコピーして 1 ページ目から取り直し、「もっと見る」は applied で続きを取る。
 */
export function ReportListScreen({
  initialPage,
  fetchReports = defaultFetchReports,
}: {
  initialPage: { reports: ReportListItem[]; nextOffset: number | null };
  /** 差し替え口（単体テスト用） */
  fetchReports?: FetchReports;
}) {
  const [draft, setDraft] = useState<ReportListState>(EMPTY_REPORT_LIST_STATE);
  const [applied, setApplied] = useState<ReportListState>(EMPTY_REPORT_LIST_STATE);
  const [reports, setReports] = useState(initialPage.reports);
  const [nextOffset, setNextOffset] = useState(initialPage.nextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // replace=true は 1 ページ目から入れ替え、false は末尾に継ぎ足す（もっと見る）
  const load = async (state: ReportListState, offset: number, replace: boolean) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const page = await fetchReports(buildReportListParams(state, offset));
      setReports((current) => (replace ? page.reports : [...current, ...page.reports]));
      setNextOffset(page.nextOffset);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage(ERROR_MESSAGES.dbLoadFailure);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setApplied(draft);
    void load(draft, 0, true);
  };

  const handleReset = () => {
    setDraft(EMPTY_REPORT_LIST_STATE);
    setApplied(EMPTY_REPORT_LIST_STATE);
    void load(EMPTY_REPORT_LIST_STATE, 0, true);
  };

  const selectClass = "h-9 rounded-[8px] border border-line bg-surface px-2 text-[12px] text-ink";

  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
      <div className="flex w-full max-w-[760px] flex-col gap-4">
        <header className="flex items-center justify-between">
          <h1 className="text-[18px] font-bold text-ink">通報一覧</h1>
          <Link href="/admin" className="text-[12px] text-muted underline underline-offset-2">
            ダッシュボードへ
          </Link>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-[12px] border border-line bg-surface p-3">
          <label className="text-[11px] text-muted">
            対応状態
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ReportStatus | "" })} className={`${selectClass} mt-0.5 block`}>
              <option value="">すべて</option>
              {REPORT_STATUSES.map((status) => (
                <option key={status} value={status}>{REPORT_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-muted">
            通報理由
            <select value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value as ReportReason | "" })} className={`${selectClass} mt-0.5 block`}>
              <option value="">すべて</option>
              {REPORT_REASONS.map((reason) => (
                <option key={reason} value={reason}>{REPORT_REASON_LABELS[reason]}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-muted">
            対象種別
            <select value={draft.targetType} onChange={(e) => setDraft({ ...draft, targetType: e.target.value as ReportTargetType | "" })} className={`${selectClass} mt-0.5 block`}>
              <option value="">すべて</option>
              {REPORT_TARGET_TYPES.map((type) => (
                <option key={type} value={type}>{REPORT_TARGET_LABELS[type]}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-muted">
            通報日（から）
            <input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className={`${selectClass} mt-0.5 block`} />
          </label>
          <label className="text-[11px] text-muted">
            通報日（まで）
            <input type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={`${selectClass} mt-0.5 block`} />
          </label>
          <button type="submit" disabled={isLoading} className="h-9 rounded-[8px] bg-ink px-4 text-[12px] font-semibold text-white disabled:opacity-45">
            絞り込む
          </button>
          <button type="button" onClick={handleReset} className="h-9 text-[12px] text-muted underline underline-offset-2">
            クリア
          </button>
        </form>

        {errorMessage && <ErrorNotice message={errorMessage} onRetry={() => void load(applied, 0, true)} />}

        {reports.length === 0 && !isLoading ? (
          <p className="py-12 text-center text-[13px] text-muted">該当する通報はありません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reports.map((report) => (
              <li key={report.id}>
                <Link
                  href={`/admin/reports/${report.id}`}
                  className="flex flex-col gap-1 rounded-[12px] border border-line bg-surface p-3 text-[12px]"
                  data-report={report.id}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-tint px-2 py-0.5 font-semibold text-accent">{REPORT_STATUS_LABELS[report.status]}</span>
                    <span className="font-semibold text-ink">{REPORT_TARGET_LABELS[report.targetType]}</span>
                    <span className="text-ink">{REPORT_REASON_LABELS[report.reason]}</span>
                    <span className="ml-auto text-[11px] text-muted">{new Date(report.createdAt).toLocaleString("ja-JP")}</span>
                  </span>
                  {report.detail && <span className="line-clamp-2 text-muted">{report.detail}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {nextOffset !== null && (
          <button
            type="button"
            onClick={() => void load(applied, nextOffset, false)}
            disabled={isLoading}
            className="h-10 w-full rounded-[10px] border border-line bg-surface text-[13px] font-semibold text-ink disabled:opacity-45"
          >
            {isLoading ? "読み込み中…" : "もっと見る"}
          </button>
        )}
      </div>
    </div>
  );
}

async function defaultFetchReports(params: URLSearchParams) {
  const query = params.toString();
  const response = await fetchWithAuthRedirect(`/api/admin/reports${query ? `?${query}` : ""}`);
  if (!response.ok) throw new Error(`Failed to fetch reports: ${response.status}`);
  return (await response.json()) as { reports: ReportListItem[]; nextOffset: number | null };
}
