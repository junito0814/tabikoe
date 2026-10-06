"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { StepUpCancelledError, useStepUp } from "./use-step-up";
import { REPORT_REASON_LABELS, REPORT_TARGET_LABELS } from "@/lib/reports/constants";
import { REPORT_STATUS_LABELS } from "@/lib/admin/report-filters";
import { MODERATION_ACTION_LABELS, type ModerationAction } from "@/lib/admin/moderation";
import type { ReportDetail } from "@/lib/admin/report-detail";
import type { ReportModerationContext } from "@/lib/admin/report-context";
import { formatDateTime } from "@/lib/format/date-time";

export type SubmitReportAction = (reportId: string, action: ModerationAction, note: string) => Promise<Response>;
/** strike-system Task 6: 登録者に修正を依頼する */
export type SubmitSpotFixRequest = (reportId: string, note: string) => Promise<Response>;

/**
 * F-AD-04 Task2（詳細確認）／F-AD-05 Task3: 通報詳細・対応操作（SC-18 詳細部分）
 * 出典: docs/tasks/admin/report-list/02-report-list-ui.md
 *       docs/tasks/admin/report-handling/03-report-action-ui.md
 *
 * 「削除」は復元不可のため、確認ダイアログで確定しない限り API を呼ばない。
 *
 * 【初心者向け】3 つの対応（非公開化／削除／問題なし）はすべて同じ `run(action)` を通り、
 * サーバー（/api/admin/reports/[id]/action）が種別ごとの実処理と通知を行う。画面側は結果の文言を出して
 * `router.refresh()` でサーバーの最新状態を取り直すだけ。対応済み（isResolved）ならボタンを無効にする。
 */
export function ReportDetailScreen({
  report,
  context = null,
  submitAction = defaultSubmitAction,
  submitSpotFixRequest = defaultSubmitSpotFixRequest,
}: {
  report: ReportDetail;
  /** strike-system Task 2: 判断の材料（投稿者のストライク・通報者の信頼度・同じ対象への通報） */
  context?: ReportModerationContext | null;
  /** 差し替え口（単体テスト用） */
  submitAction?: SubmitReportAction;
  submitSpotFixRequest?: SubmitSpotFixRequest;
}) {
  const router = useRouter();
  // admin-login Task 7: 削除のときだけサーバーが 409 を返す。そのとき小窓で 6 桁を聞き、同じ操作を送り直す
  const { submit: submitActionWithStepUp, dialog: stepUpDialog } = useStepUp(submitAction);
  const [note, setNote] = useState(report.resolutionNote ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const isResolved = report.status !== "unconfirmed" && report.status !== "in_review";
  const targetLabel = REPORT_TARGET_LABELS[report.targetType];
  // strike-system Task 2: 非公開化・削除は本人に理由を通知するので、理由が空なら押せない
  const noteMissing = note.trim().length === 0;
  const spotFix = !!context?.canRequestSpotFix;

  // strike-system Task 6: スポット情報の誤りは登録者に直してもらう（ストライクは付かない）
  const requestFix = async () => {
    if (isSubmitting || noteMissing) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await submitSpotFixRequest(report.id, note.trim());
      if (!response.ok) {
        setErrorMessage("依頼を記録できませんでした");
        return;
      }
      setResult("登録者に修正を依頼しました（確認中）。直されると自動で対応済みになります");
      router.refresh();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("依頼を記録できませんでした");
    } finally {
      setIsSubmitting(false);
    }
  };

  const run = async (action: ModerationAction) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await submitActionWithStepUp(report.id, action, note.trim());
      if (!response.ok) {
        setErrorMessage("対応を記録できませんでした");
        return;
      }
      const data = (await response.json()) as { status: keyof typeof REPORT_STATUS_LABELS; strike?: { activeCount: number } | null };
      setResult(
        `${MODERATION_ACTION_LABELS[action]}として記録しました（${REPORT_STATUS_LABELS[data.status]}）${
          data.strike ? `。投稿者に 1 ストライク（有効 ${data.strike.activeCount}）` : ""
        }`
      );
      setConfirmingDelete(false);
      router.refresh();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      // 6 桁の確認をやめただけ。失敗ではないので何も出さない（書いた理由メモもそのまま）
      if (error instanceof StepUpCancelledError) return;
      setErrorMessage("対応を記録できませんでした");
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionButton = "h-10 rounded-[8px] px-4 text-[13px] font-semibold disabled:opacity-45";

  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full flex-col gap-4">
        <header className="flex items-center justify-end">
          <Link href="/admin/reports" className="text-[12px] text-muted underline underline-offset-2">
            一覧へ
          </Link>
        </header>

        <section className="rounded-[12px] border border-line bg-surface p-4 text-[13px] text-ink">
          <dl className="grid grid-cols-[6em_1fr] gap-y-1.5">
            <dt className="text-muted">対応状態</dt>
            <dd className="font-semibold text-accent">{REPORT_STATUS_LABELS[report.status]}</dd>
            <dt className="text-muted">対象種別</dt>
            <dd>{targetLabel}</dd>
            <dt className="text-muted">通報理由</dt>
            <dd>{REPORT_REASON_LABELS[report.reason]}</dd>
            <dt className="text-muted">通報日時</dt>
            <dd>{formatDateTime(report.createdAt)}</dd>
            {report.detail && (
              <>
                <dt className="text-muted">詳細</dt>
                <dd className="whitespace-pre-wrap">{report.detail}</dd>
              </>
            )}
            {report.resolvedAt && (
              <>
                <dt className="text-muted">対応日時</dt>
                <dd>{formatDateTime(report.resolvedAt)}</dd>
              </>
            )}
            {report.resolutionNote && (
              <>
                <dt className="text-muted">対応理由</dt>
                <dd className="whitespace-pre-wrap">{report.resolutionNote}</dd>
              </>
            )}
            {context && (
              <>
                <dt className="text-muted">この通報者</dt>
                <dd className="text-muted">
                  直近90日 問題なし {context.reporter.noIssueIn90Days}／全 {context.reporter.total} 件
                  {context.reporter.noIssueIn90Days >= 3 && <span className="ml-1 rounded-full bg-line px-2 py-0.5 text-[11px]">自動非公開の人数に数えない</span>}
                </dd>
              </>
            )}
          </dl>
        </section>

        <section aria-labelledby="target-heading" className="rounded-[12px] border border-line bg-surface p-4">
          <h2 id="target-heading" className="mb-2 text-[13px] font-bold text-ink">通報された対象</h2>
          <p className="text-[13px] text-ink">
            {report.target.summary}
            {report.target.hidden && <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-[11px]">非公開化／停止済み</span>}
          </p>
          {report.target.text && (
            <p className="mt-2 whitespace-pre-wrap rounded-[8px] bg-tint p-3 text-[13px] leading-[1.7] text-ink">{report.target.text}</p>
          )}
          {report.target.imageUrls.length > 0 && (
            <ul className="mt-2 grid grid-cols-3 gap-1">
              {report.target.imageUrls.map((url) => (
                <li key={url} className="aspect-square overflow-hidden rounded-[8px] bg-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="通報対象の画像" className="h-full w-full object-cover" />
                </li>
              ))}
            </ul>
          )}
          {report.target.href && report.target.exists && (
            <Link href={report.target.href} className="mt-2 inline-block text-[12px] text-muted underline underline-offset-2">
              アプリ内で開く
            </Link>
          )}
          {context && (
            <p className="mt-2 text-[12px] text-muted">
              {context.posterId && (
                <>
                  投稿者 {context.posterName ?? "（名前なし）"}（有効ストライク {context.posterActiveStrikes}）
                  <Link href={`/admin/users/${context.posterId}`} className="ml-1 underline underline-offset-2">
                    開く
                  </Link>
                  ・
                </>
              )}
              この対象への通報 {context.distinctReporters} 人（異なる通報者 {context.autoHideReporters} 人で自動非公開）
            </p>
          )}
        </section>

        <section aria-labelledby="action-heading" className="rounded-[12px] border border-line bg-surface p-4">
          <h2 id="action-heading" className="mb-2 text-[13px] font-bold text-ink">対応操作</h2>
          {report.targetType === "user" && (
            <p className="mb-2 text-[12px] text-muted">ユーザーへの対応はアカウントの一時停止として扱います</p>
          )}
          {(report.targetType === "spot" || report.targetType === "trip") && (
            <p className="mb-2 text-[12px] text-muted">{targetLabel}への対応は{targetLabel}の非公開化として扱います（削除でも同じ）</p>
          )}
          {context && !isResolved && (
            <ul className="mb-2 list-disc pl-4 text-[12px] text-muted">
              {context.posterId ? (
                <li>
                  確定（非公開化・削除）で本人に 1 ストライク（有効 {context.posterActiveStrikes} → {context.posterActiveStrikes + 1}：{context.nextMeasure}）
                </li>
              ) : (
                <li>この対象には持ち主がいないため、ストライクは付きません</li>
              )}
              {context.severe && <li className="text-saved">個人情報の掲載・なりすましは 1 回で仮停止</li>}
              <li>本人に理由が通知されます（通報者は伝えません）</li>
            </ul>
          )}
          <label className="block text-[12px] font-medium text-muted">
            対応理由（メモ・非公開化と削除では必須）
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-[8px] border border-line px-3 py-2 text-[13px] text-ink"
            />
          </label>

          {errorMessage && <ErrorNotice className="mt-2" message={errorMessage} />}
          {result && <p role="status" className="mt-2 text-[12px] text-done">{result}</p>}

          {spotFix && !isResolved && (
            <p className="mb-2 text-[12px] text-muted">
              「タビコエだけの場所」の情報の誤りは、登録者に直してもらいます（依頼はストライクになりません。直されると通報は自動で対応済み）
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {spotFix && (
              <button type="button" onClick={() => void requestFix()} disabled={isSubmitting || isResolved || noteMissing} className={`${actionButton} bg-accent text-white`}>
                登録者に修正を依頼する
              </button>
            )}
            <button type="button" onClick={() => void run("hide")} disabled={isSubmitting || isResolved || noteMissing} className={`${actionButton} ${spotFix ? "border border-line bg-surface text-ink" : "bg-ink text-on-ink"}`}>
              {spotFix ? "スポットを非公開化する" : "非公開化"}
            </button>
            {!spotFix && (
              <button type="button" onClick={() => setConfirmingDelete(true)} disabled={isSubmitting || isResolved || noteMissing} className={`${actionButton} bg-accent text-white`}>
                削除
              </button>
            )}
            <button type="button" onClick={() => void run("no_issue")} disabled={isSubmitting || isResolved} className={`${actionButton} border border-line bg-surface text-ink`}>
              問題なし
            </button>
          </div>
          {isResolved && <p className="mt-2 text-[11px] text-muted">この通報は対応済みです</p>}
          {!isResolved && noteMissing && <p className="mt-2 text-[11px] text-muted">非公開化・削除には理由が必要です</p>}
        </section>

        {confirmingDelete && (
          <div role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
            <div className="w-full max-w-[380px] rounded-[14px] bg-surface p-6 shadow-xl">
              <h2 id="delete-dialog-title" className="mb-3 text-[16px] font-bold text-ink">削除しますか</h2>
              <p className="mb-4 text-[13px] leading-[1.7] text-ink">
                この操作は<strong>復元できません</strong>。対象を削除し、通報者に対応完了の通知を送ります。
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmingDelete(false)} disabled={isSubmitting} className="h-11 flex-1 rounded-[10px] border border-line text-[14px] font-medium text-ink">
                  キャンセル
                </button>
                <button type="button" onClick={() => void run("delete")} disabled={isSubmitting} className="h-11 flex-1 rounded-[10px] bg-accent text-[14px] font-semibold text-white disabled:opacity-45">
                  {isSubmitting ? "削除中…" : "削除する"}
                </button>
              </div>
            </div>
          </div>
        )}

        {stepUpDialog}
      </div>
    </div>
  );
}

function defaultSubmitSpotFixRequest(reportId: string, note: string): Promise<Response> {
  return fetchWithAuthRedirect(`/api/admin/reports/${reportId}/request-fix`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
}

function defaultSubmitAction(reportId: string, action: ModerationAction, note: string): Promise<Response> {
  return fetchWithAuthRedirect(`/api/admin/reports/${reportId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, note }),
  });
}
