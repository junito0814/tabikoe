"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { normalizeTotpCode } from "@/lib/admin/mfa-qr";

/**
 * admin-login Task 5: 管理者の二段階確認（SC-32）
 * 出典: docs/tasks/admin/admin-login/05-mfa-screen.md
 *       要件定義書 3.10.1・4.1（SC-32）・4.2（メニューバーを出さない）
 *       見た目: 管理画面キャンバス https://claude.ai/artifact/KoY91teZdaTPQahdk2LEhM の「0. 管理者の二段階確認」
 *
 * 【初心者向け】1 つの画面が 2 つの顔を持つ。
 *   - mode="enroll" … 認証アプリをまだ登録していない人。QR コードを出して登録させる
 *   - mode="verify" … 登録済みだが 6 桁が要る人（ログインし直した・60 分が過ぎた）
 * どちらも最後は `POST /api/admin/mfa/verify` に 6 桁を送る。通ったら元の行き先へ。
 * メニューバーは出さない（利用者向けも管理用も）。まだ管理画面に入れていないため。
 */

export interface AdminMfaEnrollment {
  factorId: string;
  qrImageSrc: string | null;
  secret: string;
}

export function AdminMfaScreen({
  mode,
  redirectTo,
  startEnroll = defaultStartEnroll,
  submitCode = defaultSubmitCode,
}: {
  mode: "enroll" | "verify";
  redirectTo: string;
  startEnroll?: () => Promise<Response>;
  submitCode?: (body: { code: string; factorId?: string }) => Promise<Response>;
}) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<AdminMfaEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparing, setIsPreparing] = useState(mode === "enroll");
  // 登録は 1 回だけ始める（開発時の二重描画で factor を 2 つ作らないように）
  const started = useRef(false);

  useEffect(() => {
    if (mode !== "enroll" || started.current) return;
    started.current = true;
    void (async () => {
      try {
        const response = await startEnroll();
        if (!response.ok) {
          setErrorMessage("登録を始められませんでした。ページを再読み込みしてください");
          return;
        }
        setEnrollment((await response.json()) as AdminMfaEnrollment);
      } catch (error) {
        if (error instanceof UnauthorizedError) return;
        setErrorMessage("登録を始められませんでした。ページを再読み込みしてください");
      } finally {
        setIsPreparing(false);
      }
    })();
  }, [mode, startEnroll]);

  const normalized = normalizeTotpCode(code);
  const canSubmit = normalized !== null && !isSubmitting && (mode === "verify" || enrollment !== null);

  const handleSubmit = async () => {
    if (!canSubmit || normalized === null) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await submitCode({ code: normalized, factorId: enrollment?.factorId });
      if (!response.ok) {
        // 入力欄は消さない。番号が合わないだけなら、そのまま入れ直せるようにする（要件 3.10.1）
        setErrorMessage(messageForError(await readError(response), mode));
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("確認できませんでした。時間をおいてお試しください");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-6 py-10">
      <div className="flex w-full max-w-[430px] flex-col gap-5">
        <p className="text-[12px] font-semibold tracking-[0.08em] text-muted">タビコエ 管理</p>

        {mode === "enroll" ? (
          <>
            <h1 className="text-[18px] font-bold text-ink">管理画面に入るには認証アプリの登録が必要です</h1>
            <p className="text-[13px] leading-[1.7] text-muted">
              この端末だけで終わります。登録を終えるとそのまま管理画面へ進みます。
            </p>
            <section className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface p-4">
              <Step num={1} title="認証アプリで読み取る" note="Google Authenticator・1Password・Authy など" />
              {isPreparing && <p className="text-[13px] text-muted">QR コードを準備しています…</p>}
              {enrollment?.qrImageSrc && (
                <Image
                  src={enrollment.qrImageSrc}
                  alt="認証アプリで読み取る QR コード"
                  width={148}
                  height={148}
                  unoptimized
                  className="rounded-[6px] border border-line bg-white"
                />
              )}
              {enrollment && (
                <div className="flex flex-col gap-1">
                  <p className="text-[12px] text-muted">読み取れないときは、この文字列を手で入れてください</p>
                  <code className="rounded-[6px] bg-app px-2 py-1.5 font-mono text-[12px] tracking-[0.14em] break-all text-ink">
                    {enrollment.secret}
                  </code>
                </div>
              )}
            </section>
          </>
        ) : (
          <h1 className="text-[18px] font-bold text-ink">認証アプリの 6 桁を入れてください</h1>
        )}

        <section className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface p-4">
          {mode === "enroll" && <Step num={2} title="表示された 6 桁を入れる" note="30 秒ごとに変わります" />}
          <label htmlFor="admin-mfa-code" className="text-[12px] text-muted">
            認証アプリの 6 桁
          </label>
          <input
            id="admin-mfa-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            // わざと大きくしている入力欄（要件 4.5.12 の 1 の対象外）
            data-keep-size=""
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleSubmit();
            }}
            className="h-[52px] rounded-[10px] border border-line bg-app px-4 text-center text-[24px] font-bold tracking-[0.3em] tabular-nums text-ink"
          />
          {errorMessage && <ErrorNotice message={errorMessage} />}
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="h-12 rounded-[10px] bg-accent text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isSubmitting ? "確認中..." : mode === "enroll" ? "登録して管理画面へ" : "管理画面へ"}
          </button>
        </section>

        {mode === "enroll" && (
          <p className="text-[11.5px] leading-[1.7] text-muted">
            <span className="font-bold text-ink">端末を失うと自分では戻せません。</span>
            認証アプリは 2 か所（別の端末かパスワード管理アプリ）に登録してください。画面に「認証アプリを解除する」は置いていません（そこが二段階確認の抜け道になるため）。
          </p>
        )}
        <Link href="/" className="text-right text-[11.5px] text-muted underline underline-offset-2">
          ← サイトへ戻る
        </Link>
      </div>
    </div>
  );
}

function Step({ num, title, note }: { num: number; title: string; note: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-app">
        {num}
      </span>
      <span className="text-[12.5px]">
        <span className="block text-[13px] font-bold text-ink">{title}</span>
        <span className="text-muted">{note}</span>
      </span>
    </div>
  );
}

async function readError(response: Response): Promise<string | undefined> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error;
}

/** エラーの種類ごとに、次に何をすればよいか分かる文にする */
function messageForError(error: string | undefined, mode: "enroll" | "verify"): string {
  if (error === "invalid_code" || error === "invalid_code_format") {
    return "番号が合いません。認証アプリに出ている今の 6 桁を入れてください";
  }
  if (error === "factor_not_found") {
    return mode === "enroll"
      ? "登録の途中でやり直しが必要です。ページを再読み込みしてください"
      : "認証アプリの登録が見つかりません。ページを再読み込みしてください";
  }
  return "確認できませんでした。時間をおいてお試しください";
}

function defaultStartEnroll(): Promise<Response> {
  return fetchWithAuthRedirect("/api/admin/mfa/enroll", { method: "POST" });
}

function defaultSubmitCode(body: { code: string; factorId?: string }): Promise<Response> {
  return fetchWithAuthRedirect("/api/admin/mfa/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
