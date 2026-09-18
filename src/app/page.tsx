import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { outfit, lora } from "./fonts";

/**
 * SC-00 トップページ
 * 出典: requirement.md 4.1（関連機能ID: ―）
 *
 * 未ログインで閲覧できる唯一の画面（3.5.4）。サービス説明とログイン・アカウント作成の導線だけを持つ。
 * ログイン済みユーザーの着地点は SC-02（全体マップ、F-MP-01）なので、そちらへ送る。
 * 投稿完了などの結果を運ぶクエリ（posted=1 / badges=... 等。古いリンク互換）はそのまま引き継ぐ。
 *
 * 【初心者向け】`async function` の Server Component。ブラウザではなくサーバーで実行され、
 * Cookie からログイン状態を確認して、ログイン済みなら `redirect()` で /map へ送る（画面は描画しない）。
 * v3.0 では、この画面が「検索トップ（ハブ）」に置き換わり、ログイン済みでもここに留まる予定（search-top ストーリー）。
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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
      if (typeof value === "string") params.set(key, value);
    }
    const query = params.toString();
    redirect(query ? `/map?${query}` : "/map");
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
        <NavLink href="/signup" label="アカウントを作成" />
        <NavLink href="/login" label="ログイン" />
      </div>
    </div>
  );
}
