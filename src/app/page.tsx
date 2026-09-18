import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SearchTopScreen } from "@/components/search/SearchTopScreen";
import { outfit, lora } from "./fonts";

/**
 * SC-00 検索トップ（ホーム）
 * 出典: docs/tasks/map-search/search-top/02-search-top-screen.md
 *       docs/tasks/account/signup-login-v3/01-post-login-redirect.md
 *       要件定義書 v3.0 3.4.1・4.1
 *
 * 【初心者向け】`async function` の Server Component。Cookie からログイン状態を確認し、
 *   - ログイン済み: 検索トップ（ハブ。SearchTopScreen）を出す。v1 の「/map へ転送」は廃止
 *   - 未ログイン: サービス説明一文とログイン・アカウント作成の導線だけ（未ログインで閲覧できる唯一の画面。3.5.4）
 * `?itinerary=&day=` が付いていれば、しおりの追加モード（add-spots Task2）として行き先の入力を促す。
 */
const NavLink = ({ href, label }: { href: string; label: string }) => (
  <Link
    href={href}
    className="flex h-12 w-full items-center justify-center rounded-[10px] border border-line bg-surface text-[14px] font-semibold text-ink"
  >
    {label}
  </Link>
);

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
    const params = await searchParams;
    const itinerary = typeof params.itinerary === "string" ? params.itinerary : null;
    const day = typeof params.day === "string" ? params.day : null;
    return <SearchTopScreen addMode={itinerary ? { itinerary, day } : null} />;
  }

  return (
    <div className={`${outfit.className} bg-sky flex min-h-screen flex-col items-center justify-center gap-8 px-6`}>
      <div className="flex flex-col items-center gap-3">
        <svg width="64" height="64" viewBox="0 0 72 72" fill="none" aria-hidden>
          <rect width="72" height="72" rx="20" fill="var(--accent)" />
          <circle cx="36" cy="28" r="10" fill="rgba(255,255,255,0.25)" />
          <circle cx="36" cy="28" r="5" fill="#FFFFFF" />
          <path d="M36 38C36 38 26 50 26 54" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M36 38C36 38 46 50 46 54" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M36 38L36 54" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <h1 className={`${lora.className} text-[24px] font-bold tracking-[2px] text-ink`}>タビコエ</h1>
        <p className="text-center text-[13px] leading-[1.7] tracking-[0.3px] text-muted">
          まだ知られていない場所の、
          <br />
          行った人のリアルな声
        </p>
      </div>

      <div className="flex w-full max-w-[320px] flex-col gap-2.5">
        <NavLink href="/signup" label="アカウントを作成" />
        <NavLink href="/login" label="ログイン" />
      </div>
    </div>
  );
}
