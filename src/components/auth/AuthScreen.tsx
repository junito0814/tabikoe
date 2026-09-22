"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { outfit, lora } from "@/app/fonts";

const MAIN = "var(--accent)";

/**
 * F-AC-01 Task3（SC-01 ログイン画面）/ Task11（2026-09-22: 入口を「Google で続ける」1 つに）
 * 出典: docs/tasks/account/signup-login/03-login-screen-ui.md
 *       docs/tasks/account/signup-login/11-google-once-signup.md
 *
 * ログインと新規登録を区別しない 1 画面（X と同じ）。同意欄はここには無く、未登録なら
 * コールバックが認証状態を保持したまま同意画面（SC-20 = SignupConsentScreen）へ送る。
 *
 * 【初心者向け】ボタンを押すと `supabase.auth.signInWithOAuth` が Google の認証ページへ移動させる。
 * 戻り先（redirectTo）に /api/auth/callback を指定し、「ログイン後に戻る場所（redirect_to）」をクエリで乗せておく。
 * 判定はすべてコールバック側（サーバー）で行う。`?error=` の値でエラーメッセージを出し分けているのは、
 * コールバックが失敗時にこの画面へ戻すため。
 */

function GoogleIcon() {
    return (
        <svg viewBox="0 0 48 48" className="h-5 w-5">
            <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
            />
            <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.1 29.6 4 24 4c-7.5 0-14 4.2-17.4 10.3z"
            />
            <path
                fill="#4CAF50"
                d="M24 44c5.5 0 10.3-1.9 14.1-5l-6.5-5.5c-2 1.4-4.6 2.2-7.6 2.2-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.9 39.6 16.4 44 24 44z"
            />
            <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.5 5.5C41.5 36.5 44 30.9 44 24c0-1.2-.1-2.4-.4-3.5z"
            />
        </svg>
    );
}

export function AppLogoIcon() {
    return (
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden>
            <rect width="72" height="72" rx="20" fill={MAIN} />
            <circle cx="36" cy="28" r="10" fill="rgba(255,255,255,0.25)" />
            <circle cx="36" cy="28" r="5" fill="#FFFFFF" />
            <path d="M36 38C36 38 26 50 26 54" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M36 38C36 38 46 50 46 54" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M36 38L36 54" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="22" cy="46" r="2.5" fill="rgba(255,255,255,0.6)" />
            <circle cx="50" cy="44" r="2" fill="rgba(255,255,255,0.5)" />
            <circle cx="30" cy="56" r="1.5" fill="rgba(255,255,255,0.4)" />
            <circle cx="48" cy="56" r="1.5" fill="rgba(255,255,255,0.4)" />
        </svg>
    );
}

export default function AuthScreen() {
    const searchParams = useSearchParams();
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(false);
    const [localError, setLocalError] = useState(false);

    const errorParam = searchParams.get("error");
    const hasSuspended = errorParam === "suspended";
    // F-AC-02 Task3: 最終利用から 30 日を超えてセッションが失効した（proxy.ts から error=expired で戻される）
    const hasExpired = errorParam === "expired";
    const hasError = localError || errorParam === "1" || hasSuspended || hasExpired;
    // F-AD-01 Task2: SC-15（管理者ログイン画面）は SC-01 を admin=1 付きで開いたもの（4.1）
    const isAdminLogin = searchParams.get("admin") === "1";

    // 同意欄はこの画面に無いので、常に押下できる
    const canSubmit = !isLoading;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setIsLoading(true);
        setLocalError(false);

        const redirectTo = safeRedirectPath(searchParams.get("redirect_to"));
        const callbackUrl = new URL("/api/auth/callback", window.location.origin);
        callbackUrl.searchParams.set("redirect_to", redirectTo);
        if (isAdminLogin) {
            callbackUrl.searchParams.set("admin", "1");
        }

        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: callbackUrl.toString(),
                // F-AC-01 Task1: 取得スコープを最小限に絞る
                // （取得情報はIdPのユーザー識別子・表示名・アイコンURL・メールアドレスのみ）
                scopes: "openid profile email",
            },
        });

        if (error) {
            setLocalError(true);
            setIsLoading(false);
        }
    };

    const errorMessage = hasSuspended
        ? "このアカウントは一時停止されています"
        : hasExpired
            ? "しばらく利用がなかったため、もう一度ログインしてください"
            : ERROR_MESSAGES.oauthFailure;

    return (
        <div
            className={`${outfit.className} flex min-h-screen flex-col items-center justify-center bg-app px-6`}
        >
            <div className="flex w-full max-w-[360px] flex-col items-center">
                <div className="relative mb-6 flex h-[160px] w-[160px] items-center justify-center">
                    <div className="absolute h-[120px] w-[120px] rounded-full border border-line opacity-60" />
                    <div className="absolute h-[160px] w-[160px] rounded-full border border-line opacity-30" />
                    <AppLogoIcon />
                </div>

                <h1
                    className={`${lora.className} mb-2.5 text-[26px] font-bold tracking-[2px] text-ink`}
                >
                    タビコエ
                </h1>
                <p className="mb-10 text-center text-[13px] leading-[1.7] tracking-[0.3px] text-muted">
                    {isAdminLogin ? (
                        <>管理者ログイン</>
                    ) : (
                        // キャッチフレーズ（2026-09-22 決定。要求定義書 0 章）
                        <>あなたのコエが、だれかのタビへ。</>
                    )}
                </p>


                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="flex h-[52px] w-full items-center justify-center gap-3 rounded-[10px] border border-line bg-surface transition-opacity disabled:cursor-not-allowed disabled:opacity-45 enabled:cursor-pointer enabled:shadow-card"
                >
                    <GoogleIcon />
                    <span className="text-[15px] font-semibold tracking-[0.2px] text-ink">
                        {isLoading ? "リダイレクト中..." : "Google で続ける"}
                    </span>
                </button>

                {hasError && <ErrorNotice className="mt-3 w-full" message={errorMessage} />}

                {/* Task11（2026-09-22）: 入口はこのボタン 1 つ。新規登録の導線は置かない（未登録なら自動で同意画面へ。3.2.1） */}
            </div>
        </div>
    );
}
