import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { outfit, lora } from "./fonts";

/**
 * SC-00 トップページ
 * 出典: requirement.md 4.1（関連機能ID: ―）
 *
 * 画面内容の仕様が要件定義書に無い唯一の画面。未ログインでも閲覧できる。
 * ログイン後の本来の着地点はSC-02（全体マップ、F-MP-01）だが未実装のため、
 * 現時点では実装済みの画面への導線のみを置いている。
 * SC-02の実装時に、ログイン済みユーザーはそちらへ遷移させること。
 */

const MAIN = "#C4703F";

function AppLogoIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 72 72" fill="none" aria-hidden>
      <rect width="72" height="72" rx="20" fill={MAIN} />
      <circle cx="36" cy="28" r="10" fill="rgba(255,255,255,0.25)" />
      <circle cx="36" cy="28" r="5" fill="#FFFFFF" />
      <path d="M36 38C36 38 26 50 26 54" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M36 38C36 38 46 50 46 54" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M36 38L36 54" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex h-12 w-full items-center justify-center rounded-[10px] border border-[#E8E1D8] bg-white text-[14px] font-semibold text-[#3D3A35] shadow-[0_2px_16px_rgba(61,58,53,0.06)]"
    >
      {label}
    </Link>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = profile?.is_admin ?? false;
  }

  return (
    <div
      className={`${outfit.className} flex min-h-screen flex-col items-center justify-center gap-8 bg-[#FBF6F0] px-6`}
    >
      <div className="flex flex-col items-center gap-3">
        <AppLogoIcon />
        <h1 className={`${lora.className} text-[24px] font-bold tracking-[2px] text-[#3D3A35]`}>
          タビコエ
        </h1>
        <p className="text-center text-[13px] leading-[1.7] tracking-[0.3px] text-[#9C9488]">
          みんなの旅の記録を、
          <br />
          次の旅のヒントに
        </p>
      </div>

      <div className="flex w-full max-w-[320px] flex-col gap-2.5">
        {user ? (
          <>
            <NavLink href="/account" label="アカウント" />
            {isAdmin && <NavLink href="/admin" label="管理者ダッシュボード" />}
          </>
        ) : (
          <>
            <NavLink href="/signup" label="アカウントを作成" />
            <NavLink href="/login" label="ログイン" />
          </>
        )}
      </div>

      {user && (
        <p className="max-w-[320px] text-center text-[11px] leading-[1.7] text-[#9C9488]">
          地図・投稿機能は開発中です
        </p>
      )}
    </div>
  );
}
