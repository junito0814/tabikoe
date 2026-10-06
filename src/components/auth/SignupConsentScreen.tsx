"use client";

import { useState } from "react";
import { hardRedirect } from "@/lib/navigation/hard-redirect";
import { outfit, lora } from "@/app/fonts";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { AppLogo } from "@/components/brand/AppLogo";
import { ConsentCheckbox } from "./ConsentCheckbox";

export interface SignupConsentApi {
  /** 同意して登録（201 なら { href } が返る） */
  signup: (input: { terms: boolean; privacy: boolean; redirectTo: string | null }) => Promise<Response>;
  /** やめる（認証状態を破棄） */
  cancel: () => Promise<Response>;
}

/**
 * signup-login Task11（2026-09-22）: SC-20 同意画面（Google の認証は済んだが未登録の人だけが見る）
 * 出典: docs/tasks/account/signup-login/11-google-once-signup.md
 *       要件定義書 v3.2 3.2.1「画面構成」「同意取得」、wireframes.md SC-20
 *
 * 【初心者向け】ここには Google のボタンが無い。SC-01 で選んだ Google アカウント（email）を表示し、
 * 利用規約・個人情報保護方針の 2 つにチェックしたら「同意してはじめる」で POST /api/auth/signup を呼び、
 * 返ってきた着地点（ホームか元の遷移先）へ移る。「やめる」は認証状態を捨ててログイン画面へ戻る。
 */
export function SignupConsentScreen({ email, redirectTo = null, api = defaultApi }: { email: string; redirectTo?: string | null; api?: SignupConsentApi }) {
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [busy, setBusy] = useState<"signup" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = agreedTerms && agreedPrivacy && busy === null;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy("signup");
    setError(null);
    try {
      const response = await api.signup({ terms: agreedTerms, privacy: agreedPrivacy, redirectTo });
      if (!response.ok) {
        setError(response.status === 400 ? "利用規約と個人情報保護方針の両方への同意が必要です" : "アカウントを作成できませんでした。時間をおいてお試しください");
        return;
      }
      const data = (await response.json()) as { href?: string };
      // #705 と同じ理由。ログインの状態が変わった直後なので読み込み直す
      hardRedirect(data.href ?? "/");
    } catch {
      setError("アカウントを作成できませんでした。時間をおいてお試しください");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (busy) return;
    setBusy("cancel");
    try {
      await api.cancel();
    } finally {
      hardRedirect("/login");
    }
  };

  return (
    <div className={`${outfit.className} flex min-h-screen flex-col items-center justify-center bg-app px-6`}>
      <div className="flex w-full max-w-[360px] flex-col items-center">
        <div className="relative mb-6 flex h-[120px] w-[120px] items-center justify-center">
          <div className="absolute h-[120px] w-[120px] rounded-full border border-line opacity-60" />
          <AppLogo />
        </div>
        <h1 className={`${lora.className} mb-2.5 text-[22px] font-bold tracking-[2px] text-ink`}>タビコエ</h1>
        <p className="mb-8 text-center text-[13px] leading-[1.7] text-muted">
          <span className="font-semibold text-ink" data-signup-email>
            {email}
          </span>
          <br />
          として登録します
        </p>

        <div className="mb-6 flex w-full flex-col gap-3">
          {/* #792: 読みに行った先から「← 同意」で戻れるように、来た画面を渡す */}
          <ConsentCheckbox checked={agreedTerms} onChange={setAgreedTerms} label="利用規約" href="/terms?back=%2Fsignup" />
          <ConsentCheckbox checked={agreedPrivacy} onChange={setAgreedPrivacy} label="個人情報保護方針" href="/privacy?back=%2Fsignup" />
        </div>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit}
          className="flex h-[52px] w-full items-center justify-center rounded-[10px] bg-accent text-[15px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy === "signup" ? "登録しています…" : "同意してはじめる"}
        </button>

        {error && <ErrorNotice className="mt-3 w-full" message={error} />}

        {/*
          * loading-feedback Task 4-6（2026-10-02）: 「やめる」も文言を変える。
          * 同じ画面の「登録しています…」と扱いが揃っていなかった（押せなくなるだけで、
          * 何も起きていないように見えた）。
          */}
        <button type="button" onClick={() => void cancel()} disabled={busy !== null} className="tap-target mt-6 text-[13px] font-medium text-muted underline underline-offset-2 disabled:opacity-45">
          {busy === "cancel" ? "やめています…" : "やめる"}
        </button>
      </div>
    </div>
  );
}

const defaultApi: SignupConsentApi = {
  signup: (input) => fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
  cancel: () => fetch("/api/auth/signup/cancel", { method: "POST" }),
};
