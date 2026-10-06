"use client";

import { useState } from "react";
import Link from "next/link";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { graphemeLength } from "@/lib/text/grapheme-length";
import {
  MAX_REPORT_DETAIL_LENGTH,
  REPORT_REASON_LABELS,
  REPORT_TARGET_LABELS,
  reasonsForTarget,
  type ReportReason,
  type ReportTargetType,
} from "@/lib/reports/constants";

export interface ReportSubmission {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail: string;
}

/**
 * F-SF-01 Task2: 通報画面（SC-11）
 * 出典: docs/tasks/safety/reporting/02-report-screen-ui.md
 *
 * 対象種別に応じて理由の選択肢を出し分ける（受入条件20）。
 * 重複通報（409）・上限超過（429）はサーバー応答をもとにメッセージを表示する。
 *
 * 【初心者向け】通報理由の選択肢は `reasonsForTarget(targetType)` が対象種別ごとに返す（なりすまし はユーザー通報だけ、など）。
 * 送信後は `isDone` を true にして完了画面に切り替える（別ページに遷移しない）。HTTP ステータスで文言を出し分けるのは、
 * サーバーが「なぜ失敗したか」を番号で返しているため（409＝重複、429＝上限、404＝対象なし）。
 */
export function ReportForm({
  targetType,
  targetId,
  returnTo,
  submitReport = defaultSubmitReport,
}: {
  targetType: ReportTargetType;
  targetId: string;
  /** 送信後・キャンセル時の戻り先 */
  returnTo: string;
  /** 差し替え口（単体テスト用） */
  submitReport?: (input: ReportSubmission) => Promise<Response>;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const detailLength = graphemeLength(detail);
  const isDetailTooLong = detailLength > MAX_REPORT_DETAIL_LENGTH;
  const canSubmit = reason !== null && !isDetailTooLong && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || reason === null) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await submitReport({ targetType, targetId, reason, detail });

      if (response.ok) {
        setIsDone(true);
        return;
      }
      if (response.status === 409) {
        setErrorMessage("この対象は既に通報済みです");
      } else if (response.status === 429) {
        setErrorMessage("通報の上限（1日20件）に達しました。しばらく時間をおいてお試しください");
      } else if (response.status === 404) {
        setErrorMessage("通報対象が見つかりませんでした");
      } else {
        setErrorMessage("通報を送信できませんでした。もう一度お試しください");
      }
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("通報を送信できませんでした。もう一度お試しください");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDone) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app px-6">
        <h1 className="text-[16px] font-bold text-ink">通報を受け付けました</h1>
        <p className="max-w-[360px] text-center text-[13px] leading-[1.7] text-ink">
          内容を確認し、必要に応じて対応します。対応が完了するまで、対象は通常どおり表示されます。
        </p>
        <Link
          href={returnTo}
          className="tap-target mt-2 text-[13px] font-medium text-accent underline underline-offset-2"
        >
          元の画面に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center gap-5 bg-app px-6 py-12">
      <h1 className="text-[16px] font-bold text-ink">
        {REPORT_TARGET_LABELS[targetType]}を通報
      </h1>

      <div className="flex w-full max-w-[360px] flex-col gap-5">
        <fieldset className="w-full">
          <legend className="mb-1.5 block text-[12px] font-medium text-muted">
            通報理由（必須）
          </legend>
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="通報理由">
            {reasonsForTarget(targetType).map((item) => (
              <label
                key={item}
                className={`flex h-11 cursor-pointer items-center gap-2.5 rounded-[10px] border bg-surface px-3 text-[14px] text-ink ${
                  reason === item ? "border-accent" : "border-line"
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={item}
                  checked={reason === item}
                  onChange={() => setReason(item)}
                  className="accent-accent"
                />
                {REPORT_REASON_LABELS[item]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="w-full">
          <label
            htmlFor="report-detail"
            className="mb-1.5 block text-[12px] font-medium text-muted"
          >
            詳細（任意）
          </label>
          <textarea
            id="report-detail"
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            rows={5}
            className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[14px] leading-[1.7] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <p
            className={`mt-1 text-[11px] ${isDetailTooLong ? "text-accent" : "text-muted"}`}
          >
            {detailLength} / {MAX_REPORT_DETAIL_LENGTH}
          </p>
        </div>

        {errorMessage && <ErrorNotice message={errorMessage} />}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="h-12 w-full rounded-[10px] bg-accent text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSubmitting ? "送信中..." : "通報する"}
        </button>

        <Link
          href={returnTo}
          className="tap-target text-center text-[13px] font-medium text-muted underline underline-offset-2"
        >
          キャンセル
        </Link>
      </div>
    </div>
  );
}

function defaultSubmitReport(input: ReportSubmission): Promise<Response> {
  return fetchWithAuthRedirect("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
