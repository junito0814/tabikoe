"use client";

import { useState } from "react";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { normalizeTotpCode } from "@/lib/admin/mfa-qr";

/**
 * admin-login Task 7: 重い操作の前の再確認の小窓
 * 出典: docs/tasks/admin/admin-login/07-step-up-reauth.md
 *       要件定義書 3.10.1「重い操作の前の再確認」
 *       見た目: 管理画面キャンバス https://claude.ai/artifact/KoY91teZdaTPQahdk2LEhM の「重い操作の前の再確認」
 *
 * 【初心者向け】ここで大事なのは**画面を移らないこと**。SC-32 へ転送してしまうと、
 * 管理者がさっき書いた理由メモが消えて、戻ってきてから書き直すことになる。
 * だから後ろの画面をそのまま残し、小窓だけを重ねる。
 */
export function StepUpDialog({
  onDone,
  verify = defaultVerify,
}: {
  /** 通ったら true、やめたら false */
  onDone: (passed: boolean) => void;
  /** 差し替え口（単体テスト用） */
  verify?: (code: string) => Promise<Response>;
}) {
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalized = normalizeTotpCode(code);
  const canSubmit = normalized !== null && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || normalized === null) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await verify(normalized);
      if (!response.ok) {
        setErrorMessage("番号が合いません。認証アプリに出ている今の 6 桁を入れてください");
        return;
      }
      onDone(true);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("確認できませんでした。時間をおいてお試しください");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="step-up-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-[390px] rounded-[14px] bg-surface p-6 shadow-xl">
        <h2 id="step-up-title" className="mb-1 text-[16px] font-bold text-ink">
          この操作には確認が必要です
        </h2>
        <p className="mb-4 text-[13px] leading-[1.7] text-muted">
          取り消せない操作なので、認証アプリの 6 桁をもう一度入れてください。入力した内容はそのまま残ります。
        </p>
        <label htmlFor="step-up-code" className="text-[12px] text-muted">
          認証アプリの 6 桁
        </label>
        <input
          id="step-up-code"
          name="stepUpCode"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          autoFocus
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleSubmit();
          }}
          className="mt-1 mb-3 h-[52px] w-full rounded-[10px] border border-line bg-app px-4 text-center text-[24px] font-bold tracking-[0.3em] tabular-nums text-ink"
        />
        {errorMessage && <ErrorNotice message={errorMessage} className="mb-3" />}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onDone(false)}
            disabled={isSubmitting}
            className="h-11 flex-1 rounded-[10px] border border-line text-[14px] font-medium text-ink"
          >
            やめる
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="h-11 flex-1 rounded-[10px] bg-accent text-[14px] font-semibold text-white disabled:opacity-45"
          >
            {isSubmitting ? "確認中…" : "確認して続ける"}
          </button>
        </div>
      </div>
    </div>
  );
}

function defaultVerify(code: string): Promise<Response> {
  return fetchWithAuthRedirect("/api/admin/mfa/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
}
