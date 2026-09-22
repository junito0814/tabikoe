"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { outfit, lora } from "@/app/fonts";

const MAIN = "var(--accent)";

/**
 * F-AC-01 Task3（SC-01 ログイン画面）/ Task7（SC-20 アカウント新規作成画面）
 * 出典: docs/tasks/account/signup-login/03-login-screen-ui.md
 *       docs/tasks/account/signup-login/07-consent-flow.md
 *
 * 2画面はロゴ・OAuth呼び出し・redirect_toの引き継ぎが共通で、
 * 違いは同意欄の有無と文言・遷移先だけのため、mode で切り替える1コンポーネントにしている。
 * 同意欄はSC-20にのみ表示する（要件定義書3.2.1、v2.8）。
 *
 * 【初心者向け】ボタンを押すと `supabase.auth.signInWithOAuth` が Google の認証ページへ移動させる。
 * 戻り先（redirectTo）に /api/auth/callback を指定し、そこに「どの画面から来たか（mode）」「同意したか（consent）」
 * 「ログイン後に戻る場所（redirect_to）」をクエリで乗せておく。判定はすべてコールバック側（サーバー）で行う。
 * `?error=` の値でエラーメッセージを出し分けているのは、コールバックが失敗時にこの画面へ戻すため。
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

/**
 * 同意のチェック 1 つ分（利用規約／個人情報保護方針）。
 * 【初心者向け】実際の checkbox を視覚的に隠して置き（sr-only）、見た目は隣の span で描く。
 * こうするとキーボード（Tab → Space）とスクリーンリーダーでも操作できる（要件定義書 7.7）。
 */
function ConsentCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
    return (
        <label className="flex w-full cursor-pointer items-start gap-2.5">
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                aria-label={`${label}に同意する`}
                className="peer sr-only"
            />
            <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 ${checked ? "bg-accent border-accent" : "border-line bg-transparent"}`}
            >
                {checked && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </span>
            <span className="select-none text-[13px] leading-[1.65] text-ink">
                <span className="font-medium text-accent">{label}</span>
                {" に同意する"}
            </span>
        </label>
    );
}

export default function AuthScreen({ mode }: { mode: AuthMode }) {
    const isSignup = mode === "signup";
    const searchParams = useSearchParams();
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(false);
    // signup-login Task10（2026-09-22）: 同意は「利用規約」「個人情報保護方針」の 2 つに分け、両方必須
    const [agreedTerms, setAgreedTerms] = useState(false);
    const [agreedPrivacy, setAgreedPrivacy] = useState(false);
    const agreed = agreedTerms && agreedPrivacy;
    const [localError, setLocalError] = useState(false);

    const errorParam = searchParams.get("error");
    const hasConsentError = errorParam === "consent_required";
    const hasAccountNotFound = errorParam === "account_not_found";
    const hasSuspended = errorParam === "suspended";
    // F-AC-02 Task3: 最終利用から 30 日を超えてセッションが失効した（proxy.ts から error=expired で戻される）
    const hasExpired = errorParam === "expired";
    const hasError = localError || errorParam === "1" || hasConsentError || hasAccountNotFound || hasSuspended || hasExpired;
    // F-AD-01 Task2: SC-15（管理者ログイン画面）は SC-01 を admin=1 付きで開いたもの（4.1）
    const isAdminLogin = !isSignup && searchParams.get("admin") === "1";

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
        if (isAdminLogin) {
            callbackUrl.searchParams.set("admin", "1");
        }
        if (isSignup) {
            // consent は互換のため残し、サーバーは terms と privacy の両方を確認する（Task10）
            callbackUrl.searchParams.set("consent", agreed ? "1" : "0");
            callbackUrl.searchParams.set("terms", agreedTerms ? "1" : "0");
            callbackUrl.searchParams.set("privacy", agreedPrivacy ? "1" : "0");
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
            : hasSuspended
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
                        <>
                            みんなの旅の記録を、
                            <br />
                            次の旅のヒントに
                        </>
                    )}
                </p>

                {isSignup && (
                    <div className="mb-5 flex w-full flex-col gap-3">
                        <ConsentCheckbox checked={agreedTerms} onChange={setAgreedTerms} label="利用規約" />
                        <ConsentCheckbox checked={agreedPrivacy} onChange={setAgreedPrivacy} label="個人情報保護方針" />
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="flex h-[52px] w-full items-center justify-center gap-3 rounded-[10px] border border-line bg-surface transition-opacity disabled:cursor-not-allowed disabled:opacity-45 enabled:cursor-pointer enabled:shadow-card"
                >
                    <GoogleIcon />
                    <span className="text-[15px] font-semibold tracking-[0.2px] text-ink">
                        {isLoading
                            ? "リダイレクト中..."
                            : isSignup
                                ? "Googleでアカウントを作成"
                                : "Googleでログイン"}
                    </span>
                </button>

                {hasError && <ErrorNotice className="mt-3 w-full" message={errorMessage} />}

                {/* Task10（2026-09-22）: SC-01 に「新規登録」の導線は置かない。未登録ならログイン後に自動で SC-20 へ（3.2.1） */}
                {isSignup && (
                    <p className="mt-8 text-center text-[13px] leading-[1.7] text-muted">
                        すでにアカウントをお持ちの方は{" "}
                        <Link href="/login" className="font-medium text-accent underline underline-offset-2">
                            ログイン
                        </Link>
                    </p>
                )}
            </div>
        </div>
    );
}
