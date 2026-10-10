"use client";

import { useMemo, useState, type FormEvent } from "react";
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
} from "@/lib/admin/report-filters";
import { buildReportListParams, EMPTY_REPORT_LIST_STATE, type ReportListState } from "./report-list-query";
import { formatDateTime } from "@/lib/format/date-time";
import { differsFromReporter, formatUrgency, shouldShowReason, urgencyLevel, type UrgencyLevel } from "@/lib/jev/triage-report";
import { oldestOpenDays } from "@/lib/jev/triage-report";

/** 「未対応」とみなす状態（要件 3.8.1） */
const OPEN_STATUSES: string[] = ["unconfirmed", "in_review"];

/** 緊急度の札の色。赤（すぐ）・橙（早め）・灰（急がない） */
function urgencyChip(level: UrgencyLevel): string {
  if (level === "high") return "bg-saved text-white";
  if (level === "mid") return "bg-star text-ink";
  return "bg-tint text-muted";
}

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
  initialState = EMPTY_REPORT_LIST_STATE,
  fetchReports = defaultFetchReports,
}: {
  initialPage: { reports: ReportListItem[]; nextOffset: number | null };
  /** URL のクエリから作った初期の絞り込み（ダッシュボードから来たとき。admin-shell-dashboard Task 2） */
  initialState?: ReportListState;
  /** 差し替え口（単体テスト用） */
  fetchReports?: FetchReports;
}) {
  const [draft, setDraft] = useState<ReportListState>(initialState);
  const [applied, setApplied] = useState<ReportListState>(initialState);
  const [reports, setReports] = useState(initialPage.reports);
  const [nextOffset, setNextOffset] = useState(initialPage.nextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /*
   * #892: いちばん古い「未対応」が何日前か。
   *
   * 【初心者向け】いま画面に出ている通報だけを見ます。**全件を数えません**。
   * 1 ページ目の末尾より古いものはまだ取っていませんが、
   * 「古いものがある」と気づかせるにはこれで足ります（数えるために全件を引くのは重い）。
   */
  const oldestDays = useMemo(
    () => oldestOpenDays(reports.filter((r) => OPEN_STATUSES.includes(r.status)).map((r) => r.createdAt), new Date()),
    [reports]
  );

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

  const selectClass = "h-9 rounded-[8px] border border-line bg-surface px-2 text-[0.75rem] text-ink";

  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full flex-col gap-4">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-[12px] border border-line bg-surface p-3">
          <label className="text-[0.6875rem] text-muted">
            対応状態
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ReportListState["status"] })} className={`${selectClass} mt-0.5 block`}>
              <option value="">すべて</option>
              <option value="open">未対応（未確認＋確認中）</option>
              {REPORT_STATUSES.map((status) => (
                <option key={status} value={status}>{REPORT_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </label>
          <label className="text-[0.6875rem] text-muted">
            通報理由
            <select value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value as ReportReason | "" })} className={`${selectClass} mt-0.5 block`}>
              <option value="">すべて</option>
              {REPORT_REASONS.map((reason) => (
                <option key={reason} value={reason}>{REPORT_REASON_LABELS[reason]}</option>
              ))}
            </select>
          </label>
          <label className="text-[0.6875rem] text-muted">
            対象種別
            <select value={draft.targetType} onChange={(e) => setDraft({ ...draft, targetType: e.target.value as ReportTargetType | "" })} className={`${selectClass} mt-0.5 block`}>
              <option value="">すべて</option>
              {REPORT_TARGET_TYPES.map((type) => (
                <option key={type} value={type}>{REPORT_TARGET_LABELS[type]}</option>
              ))}
            </select>
          </label>
          <label className="text-[0.6875rem] text-muted">
            通報日（から）
            <input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className={`${selectClass} mt-0.5 block`} />
          </label>
          <label className="text-[0.6875rem] text-muted">
            通報日（まで）
            <input type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={`${selectClass} mt-0.5 block`} />
          </label>
          {/* #892（決定事項 89）: 既定は Jev の緊急度が高い順。古い順も残す */}
          <label className="text-[0.6875rem] text-muted">
            並び
            <select
              value={draft.sort ?? "urgency"}
              onChange={(e) => setDraft({ ...draft, sort: e.target.value as ReportListState["sort"] })}
              className={`${selectClass} mt-0.5 block`}
            >
              <option value="urgency">緊急度が高い順</option>
              <option value="newest">新しい順</option>
              <option value="oldest">古い順</option>
            </select>
          </label>
          <button type="submit" disabled={isLoading} className="h-9 rounded-[8px] bg-ink px-4 text-[0.75rem] font-semibold text-on-ink disabled:opacity-45">
            絞り込む
          </button>
          <button type="button" onClick={handleReset} className="h-9 text-[0.75rem] text-muted underline underline-offset-2">
            クリア
          </button>
        </form>

        {errorMessage && <ErrorNotice message={errorMessage} onRetry={() => void load(applied, 0, true)} />}

        {/*
          * #892（決定事項 89・2026-10-11）: 古い通報が埋もれないように。
          *
          * 【初心者向け】並びを「緊急度が高い順」にしたので、**古いものが後ろに回ります**。
          * もとの「古い順」には「放置しない」という目的があったので、その目的だけをここで守ります。
          */}
        {oldestDays !== null && oldestDays >= 1 && applied.sort !== "oldest" && (
          <p className="flex flex-wrap items-center gap-2 rounded-[10px] border border-accent bg-tint px-3 py-2 text-[0.75rem] text-ink">
            <span>
              最も古い未対応は <b className="font-bold">{oldestDays} 日前</b>です
            </span>
            <button
              type="button"
              onClick={() => {
                const next = { ...applied, sort: "oldest" as const };
                setDraft(next);
                setApplied(next);
                void load(next, 0, true);
              }}
              className="font-semibold text-accent underline underline-offset-2"
            >
              古い順で見る
            </button>
          </p>
        )}

        {reports.length === 0 && !isLoading ? (
          <p className="py-12 text-center text-[0.8125rem] text-muted">該当する通報はありません</p>
        ) : (
          /*
           * #892: カードから**表**に戻した。
           *
           * 【初心者向け】ワイヤーフレームも管理画面のキャンバスも、SC-18 は**最初から表**でした。
           * カードで実装されていたほうがズレていたので、この機会に戻しています。
           * 表のほうが、**通報理由と Jev の見立てが隣どうしに並ぶ**ので、食い違いが一目で分かります。
           */
          <div className="overflow-x-auto rounded-[12px] border border-line bg-surface">
            <table className="w-full min-w-[720px] border-collapse text-[0.75rem]">
              <thead>
                <tr className="border-b border-line text-left text-[0.6875rem] text-muted">
                  <th className="px-3 py-2 font-medium">緊急度</th>
                  <th className="px-3 py-2 font-medium">状態</th>
                  <th className="px-3 py-2 font-medium">対象</th>
                  <th className="px-3 py-2 font-medium">通報理由</th>
                  <th className="px-3 py-2 font-medium">Jev の見立て</th>
                  <th className="px-3 py-2 font-medium">通報者のメモ</th>
                  <th className="px-3 py-2 font-medium">通報日</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const show = report.jev !== null && shouldShowReason(report.jev);
                  const differs = report.jev !== null && differsFromReporter(report.reason, report.jev);
                  const urgency = report.jev?.urgency ?? null;
                  return (
                    <tr key={report.id} className="border-b border-line last:border-0" data-report={report.id}>
                      <td className="px-3 py-2.5">
                        {urgency === null ? (
                          <span className="text-muted">―</span>
                        ) : (
                          <span className={`rounded-full px-2 py-0.5 font-bold tabular-nums ${urgencyChip(urgencyLevel(urgency))}`}>
                            {formatUrgency(urgency)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="whitespace-nowrap rounded-full bg-tint px-2 py-0.5 font-semibold text-accent">{REPORT_STATUS_LABELS[report.status]}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-ink">{REPORT_TARGET_LABELS[report.targetType]}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ink">{REPORT_REASON_LABELS[report.reason]}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {show && report.jev?.reason ? (
                          <span className={differs ? "font-bold text-ink" : "text-muted"}>
                            {REPORT_REASON_LABELS[report.jev.reason as ReportReason]}
                          </span>
                        ) : (
                          <span className="text-muted">―</span>
                        )}
                      </td>
                      <td className="max-w-[240px] px-3 py-2.5">
                        <span className="line-clamp-1 text-muted">{report.detail ?? "―"}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[0.6875rem] text-muted">{formatDateTime(report.createdAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <Link href={`/admin/reports/${report.id}`} className="font-semibold text-accent underline underline-offset-2">
                          開く
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {nextOffset !== null && (
          <button
            type="button"
            onClick={() => void load(applied, nextOffset, false)}
            disabled={isLoading}
            className="h-10 w-full rounded-[10px] border border-line bg-surface text-[0.8125rem] font-semibold text-ink disabled:opacity-45"
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
