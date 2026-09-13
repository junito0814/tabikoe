"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { REPORT_REASON_LABELS, REPORT_TARGET_LABELS } from "@/lib/reports/constants";
import { REPORT_STATUS_LABELS } from "@/lib/admin/report-filters";
import { MODERATION_ACTION_LABELS, type ModerationAction } from "@/lib/admin/moderation";
import type { ReportDetail } from "@/lib/admin/report-detail";

export type SubmitReportAction = (reportId: string, action: ModerationAction, note: string) => Promise<Response>;

/**
 * F-AD-04 Task2（詳細確認）／F-AD-05 Task3: 通報詳細・対応操作（SC-18 詳細部分）
 * 出典: docs/tasks/admin/report-list/02-report-list-ui.md
 *       docs/tasks/admin/report-handling/03-report-action-ui.md
 *
 * 「削除」は復元不可のため、確認ダイアログで確定しない限り API を呼ばない。
 */
export function ReportDetailScreen({
  report,
  submitAction = defaultSubmitAction,
}: {
  report: ReportDetail;
  /** 差し替え口（単体テスト用） */
  submitAction?: SubmitReportAction;
}) {
  const router = useRouter();
  const [note, setNote] = useState(report.resolutionNote ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const isResolved = report.status !== "unconfirmed" && report.status !== "in_review";
  const targetLabel = REPORT_TARGET_LABELS[report.targetType];

  const run = async (action: ModerationAction) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await submitAction(report.id, action, note.trim());
      if (!response.ok) {
        setErrorMessage("対応を記録できませんでした");
        return;
      }
      const data = (await response.json()) as { status: keyof typeof REPORT_STATUS_LABELS };
      setResult(`${MODERATION_ACTION_LABELS[action]}として記録しました（${REPORT_STATUS_LABELS[data.status]}）`);
      setConfirmingDelete(false);
      router.refresh();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("対応を記録できませんでした");
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionButton = "h-10 rounded-[8px] px-4 text-[13px] font-semibold disabled:opacity-45";

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#FBF6F0] px-4 py-6">
      <div className="flex w-full max-w-[640px] flex-col gap-4">
        <header className="flex items-center justify-between">
          <h1 className="text-[18px] font-bold text-[#3D3A35]">通報の詳細</h1>
          <Link href="/admin/reports" className="text-[12px] text-[#9C9488] underline underline-offset-2">
            一覧へ
          </Link>
        </header>

        <section className="rounded-[12px] border border-[#E8E1D8] bg-white p-4 text-[13px] text-[#3D3A35]">
          <dl className="grid grid-cols-[6em_1fr] gap-y-1.5">
            <dt className="text-[#9C9488]">対応状態</dt>
            <dd className="font-semibold text-[#C4703F]">{REPORT_STATUS_LABELS[report.status]}</dd>
            <dt className="text-[#9C9488]">対象種別</dt>
            <dd>{targetLabel}</dd>
            <dt className="text-[#9C9488]">通報理由</dt>
            <dd>{REPORT_REASON_LABELS[report.reason]}</dd>
            <dt className="text-[#9C9488]">通報日時</dt>
            <dd>{new Date(report.createdAt).toLocaleString("ja-JP")}</dd>
            {report.detail && (
              <>
                <dt className="text-[#9C9488]">詳細</dt>
                <dd className="whitespace-pre-wrap">{report.detail}</dd>
              </>
            )}
            {report.resolvedAt && (
              <>
                <dt className="text-[#9C9488]">対応日時</dt>
                <dd>{new Date(report.resolvedAt).toLocaleString("ja-JP")}</dd>
              </>
            )}
            {report.resolutionNote && (
              <>
                <dt className="text-[#9C9488]">対応理由</dt>
                <dd className="whitespace-pre-wrap">{report.resolutionNote}</dd>
              </>
            )}
          </dl>
        </section>

        <section aria-labelledby="target-heading" className="rounded-[12px] border border-[#E8E1D8] bg-white p-4">
          <h2 id="target-heading" className="mb-2 text-[13px] font-bold text-[#3D3A35]">通報された対象</h2>
          <p className="text-[13px] text-[#3D3A35]">
            {report.target.summary}
            {report.target.hidden && <span className="ml-2 rounded-full bg-[#E8E1D8] px-2 py-0.5 text-[11px]">非公開化／停止済み</span>}
          </p>
          {report.target.text && (
            <p className="mt-2 whitespace-pre-wrap rounded-[8px] bg-[#FBF6F0] p-3 text-[13px] leading-[1.7] text-[#3D3A35]">{report.target.text}</p>
          )}
          {report.target.imageUrls.length > 0 && (
            <ul className="mt-2 grid grid-cols-3 gap-1">
              {report.target.imageUrls.map((url) => (
                <li key={url} className="aspect-square overflow-hidden rounded-[8px] bg-[#E8E1D8]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="通報対象の画像" className="h-full w-full object-cover" />
                </li>
              ))}
            </ul>
          )}
          {report.target.href && report.target.exists && (
            <Link href={report.target.href} className="mt-2 inline-block text-[12px] text-[#9C9488] underline underline-offset-2">
              アプリ内で開く
            </Link>
          )}
        </section>

        <section aria-labelledby="action-heading" className="rounded-[12px] border border-[#E8E1D8] bg-white p-4">
          <h2 id="action-heading" className="mb-2 text-[13px] font-bold text-[#3D3A35]">対応操作</h2>
          {report.targetType === "user" && (
            <p className="mb-2 text-[12px] text-[#9C9488]">ユーザーへの対応はアカウントの一時停止として扱います</p>
          )}
          {(report.targetType === "spot" || report.targetType === "trip") && (
            <p className="mb-2 text-[12px] text-[#9C9488]">{targetLabel}への対応は{targetLabel}の非公開化として扱います（削除でも同じ）</p>
          )}
          <label className="block text-[12px] font-medium text-[#9C9488]">
            対応理由（任意メモ）
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-[8px] border border-[#E8E1D8] px-3 py-2 text-[13px] text-[#3D3A35]"
            />
          </label>

          {errorMessage && <ErrorNotice className="mt-2" message={errorMessage} />}
          {result && <p role="status" className="mt-2 text-[12px] text-[#3D7A5C]">{result}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void run("hide")} disabled={isSubmitting || isResolved} className={`${actionButton} bg-[#3D3A35] text-white`}>
              非公開化
            </button>
            <button type="button" onClick={() => setConfirmingDelete(true)} disabled={isSubmitting || isResolved} className={`${actionButton} bg-[#C4703F] text-white`}>
              削除
            </button>
            <button type="button" onClick={() => void run("no_issue")} disabled={isSubmitting || isResolved} className={`${actionButton} border border-[#E8E1D8] bg-white text-[#3D3A35]`}>
              問題なし
            </button>
          </div>
          {isResolved && <p className="mt-2 text-[11px] text-[#9C9488]">この通報は対応済みです</p>}
        </section>

        {confirmingDelete && (
          <div role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
            <div className="w-full max-w-[380px] rounded-[14px] bg-white p-6 shadow-xl">
              <h2 id="delete-dialog-title" className="mb-3 text-[16px] font-bold text-[#3D3A35]">削除しますか</h2>
              <p className="mb-4 text-[13px] leading-[1.7] text-[#3D3A35]">
                この操作は<strong>復元できません</strong>。対象を削除し、通報者に対応完了の通知を送ります。
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmingDelete(false)} disabled={isSubmitting} className="h-11 flex-1 rounded-[10px] border border-[#E8E1D8] text-[14px] font-medium text-[#3D3A35]">
                  キャンセル
                </button>
                <button type="button" onClick={() => void run("delete")} disabled={isSubmitting} className="h-11 flex-1 rounded-[10px] bg-[#C4703F] text-[14px] font-semibold text-white disabled:opacity-45">
                  {isSubmitting ? "削除中…" : "削除する"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function defaultSubmitAction(reportId: string, action: ModerationAction, note: string): Promise<Response> {
  return fetchWithAuthRedirect(`/api/admin/reports/${reportId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, note }),
  });
}
