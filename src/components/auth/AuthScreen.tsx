"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { outfit, lora } from "@/app/fonts";

const MAIN = "#C4703F";

/**
 * F-AC-01 Task3（SC-01 ログイン画面）/ Task7（SC-20 アカウント新規作成画面）
 * 出典: docs/tasks/account/signup-login/03-login-screen-ui.md
 *       docs/tasks/account/signup-login/07-consent-flow.md
 *
 * 2画面はロゴ・OAuth呼び出し・redirect_toの引き継ぎが共通で、
 * 違いは同意欄の有無と文言・遷移先だけのため、mode で切り替える1コンポーネントにしている。
 * 同意欄はSC-20にのみ表示する（要件定義書3.2.1、v2.8）。
 */
export type AuthMode = "login" | "signup";

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

function AppLogoIcon() {
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

export default function AuthScreen({ mode }: { mode: AuthMode }) {
    const isSignup = mode === "signup";
    const searchParams = useSearchParams();
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [localError, setLocalError] = useState(false);

    const errorParam = searchParams.get("error");
    const hasConsentError = errorParam === "consent_required";
    const hasAccountNotFound = errorParam === "account_not_found";
    const hasError = localError || errorParam === "1" || hasConsentError || hasAccountNotFound;

    // SC-01は同意欄を持たないため、常に押下できる
    const canSubmit = (!isSignup || agreed) && !isLoading;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setIsLoading(true);
        setLocalError(false);

        const redirectTo = safeRedirectPath(searchParams.get("redirect_to"));
        const callbackUrl = new URL("/api/auth/callback", window.location.origin);
        callbackUrl.searchParams.set("redirect_to", redirectTo);
        callbackUrl.searchParams.set("mode", mode);
        if (isSignup) {
            callbackUrl.searchParams.set("consent", agreed ? "1" : "0");
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

    const errorMessage = hasAccountNotFound
        ? "アカウントが見つかりません。新規登録してください"
        : hasConsentError
            ? "利用規約と個人情報保護方針への同意が必要です"
            : ERROR_MESSAGES.oauthFailure;

    return (
        <div
            className={`${outfit.className} flex min-h-screen flex-col items-center justify-center bg-[#FBF6F0] px-6`}
        >
            <div className="flex w-full max-w-[360px] flex-col items-center">
                <div className="relative mb-6 flex h-[160px] w-[160px] items-center justify-center">
                    <div className="absolute h-[120px] w-[120px] rounded-full border border-[#E8E1D8] opacity-60" />
                    <div className="absolute h-[160px] w-[160px] rounded-full border border-[#E8E1D8] opacity-30" />
                    <AppLogoIcon />
                </div>

                <h1
                    className={`${lora.className} mb-2.5 text-[26px] font-bold tracking-[2px] text-[#3D3A35]`}
                >
                    タビコエ
                </h1>
                <p className="mb-10 text-center text-[13px] leading-[1.7] tracking-[0.3px] text-[#9C9488]">
                    みんなの旅の記録を、
                    <br />
                    次の旅のヒントに
                </p>

                {isSignup && (
                    <label className="mb-5 flex w-full cursor-pointer items-start gap-2.5">
                        {/* 実際のcheckboxを視覚的に隠して置くことで、キーボード操作（Tab→Space）と
                            スクリーンリーダー対応を担保する（要件定義書7.7） */}
                        <input
                            type="checkbox"
                            checked={agreed}
                            onChange={(event) => setAgreed(event.target.checked)}
                            className="peer sr-only"
                        />
                        <span
                            aria-hidden
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#C4703F] peer-focus-visible:ring-offset-2 ${agreed ? "bg-[#C4703F] border-[#C4703F]" : "border-[#E8E1D8] bg-transparent"
                                }`}
                        >
                            {agreed && (
                                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                        </span>
                        <span className="select-none text-[13px] leading-[1.65] text-[#3D3A35]">
                            <span className="font-medium text-[#C4703F]">利用規約</span>
                            {" と "}
                            <span className="font-medium text-[#C4703F]">個人情報保護方針</span>
                            {" に同意する"}
                        </span>
                    </label>
                )}

                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="flex h-[52px] w-full items-center justify-center gap-3 rounded-[10px] border border-[#E8E1D8] bg-white transition-opacity disabled:cursor-not-allowed disabled:opacity-45 enabled:cursor-pointer enabled:shadow-[0_2px_16px_rgba(61,58,53,0.1)]"
                >
                    <GoogleIcon />
                    <span className="text-[15px] font-semibold tracking-[0.2px] text-[#3D3A35]">
                        {isLoading
                            ? "リダイレクト中..."
                            : isSignup
                                ? "Googleでアカウントを作成"
                                : "Googleでログイン"}
                    </span>
                </button>

                {hasError && <ErrorNotice className="mt-3 w-full" message={errorMessage} />}

                <p className="mt-8 text-center text-[13px] leading-[1.7] text-[#9C9488]">
                    {isSignup ? (
                        <>
                            すでにアカウントをお持ちの方は{" "}
                            <Link href="/login" className="font-medium text-[#C4703F] underline underline-offset-2">
                                ログイン
                            </Link>
                        </>
                    ) : (
                        <>
                            アカウントをお持ちでない方は{" "}
                            <Link href="/signup" className="font-medium text-[#C4703F] underline underline-offset-2">
                                新規登録
                            </Link>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}
