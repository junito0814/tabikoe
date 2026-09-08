"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { outfit, lora } from "./fonts";

const MAIN = "#C4703F";

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

export default function LoginForm() {
    const searchParams = useSearchParams();
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [localError, setLocalError] = useState(false);
    const hasError = localError || searchParams.get("error") === "1";

    const handleLogin = async () => {
        if (!agreed || isLoading) return;
        setIsLoading(true);
        setLocalError(false);

        const redirectTo = safeRedirectPath(searchParams.get("redirect_to"));
        const callbackUrl = new URL("/api/auth/callback", window.location.origin);
        callbackUrl.searchParams.set("redirect_to", redirectTo);

        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: callbackUrl.toString(),
            },
        });

        if (error) {
            setLocalError(true);
            setIsLoading(false);
        }
    };

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

                <label className="mb-5 flex w-full cursor-pointer items-start gap-2.5">
                    <span
                        role="checkbox"
                        aria-checked={agreed}
                        onClick={() => setAgreed((v) => !v)}
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${agreed ? "bg-[#C4703F] border-[#C4703F]" : "border-[#E8E1D8] bg-transparent"
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

                <button
                    type="button"
                    onClick={handleLogin}
                    disabled={!agreed || isLoading}
                    className="flex h-[52px] w-full items-center justify-center gap-3 rounded-[10px] border border-[#E8E1D8] bg-white transition-opacity disabled:cursor-not-allowed disabled:opacity-45 enabled:cursor-pointer enabled:shadow-[0_2px_16px_rgba(61,58,53,0.1)]"
                >
                    <GoogleIcon />
                    <span className="text-[15px] font-semibold tracking-[0.2px] text-[#3D3A35]">
                        {isLoading ? "リダイレクト中..." : "Googleでログイン"}
                    </span>
                </button>

                {hasError && (
                    <div className="mt-3 flex w-full items-center gap-2 rounded-lg border border-[#C4703F]/25 bg-[#C4703F]/[0.08] px-3.5 py-2.5">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0">
                            <circle cx="12" cy="12" r="9" stroke="#C4703F" strokeWidth="1.8" />
                            <line x1="12" y1="8" x2="12" y2="13" stroke="#C4703F" strokeWidth="1.8" strokeLinecap="round" />
                            <circle cx="12" cy="16.5" r="1" fill="#C4703F" />
                        </svg>
                        <span className="text-[13px] leading-[1.5] text-[#C4703F]">
                            ログインに失敗しました。もう一度お試しください
                        </span>
                    </div>
                )}

                <p className="mt-8 text-center text-[11px] leading-[1.7] tracking-[0.2px] text-[#9C9488]">
                    初めての方はログインすると
                    <br />
                    自動的にアカウントが作成されます
                </p>
            </div>
        </div>
    );
}
