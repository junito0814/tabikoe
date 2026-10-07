import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { WishlistScreen } from "@/components/wishlist/WishlistScreen";
import { resolveListBack } from "@/lib/search/list-state";
import { parseWishlistView } from "@/lib/wishlist/wishlist-view";
import { getWishlistItems } from "@/lib/wishlist/get-wishlist-items";
import type { WishlistItem } from "@/lib/wishlist/constants";
import { ContentEnter } from "@/components/transitions/Reveal";
import { parseListSort } from "@/lib/records/list-sort";

// #785: ブラウザのタブ名（「行きたい | タビコエ」）
export const metadata = { title: "行きたい" };

/**
 * SC-08 「行きたい」スポット一覧画面
 * 出典: docs/tasks/records/wishlist/02-wishlist-list-screen.md
 *
 * ログイン必須（4.1）。マイページ（SC-06, Phase 7）からの導線は my-page Task4 で置く。
 */
export default async function WishlistPage({ searchParams }: { searchParams: Promise<{ view?: string; back?: string; sort?: string }> }) {
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, "/wishlist");
  const { view, back, sort: sortParam } = await searchParams;
  // #797: アルバム一覧と同じ並び順（既定は新着順）
  const sort = parseListSort(sortParam);

  let items: WishlistItem[] | null = null;
  try {
    items = await getWishlistItems(createAdminClient(), user.id, sort);
  } catch {
    items = null;
  }

  if (items === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  return (
    <ContentEnter>
      {/*
        * #863（2026-10-07）: `key` に並び順を入れて、変わったら部品を作り直す。
        *
        * 【初心者向け】`WishlistScreen` は一覧を `useState(initialItems)` に持っている
        * （「行きたいから外したらその場で消す」ため）。`useState` の初期値は**いちばん最初しか見ない**ので、
        * 並べ替えた結果が届いても画面は古い順のままだった。`key` が変わると React は部品ごと作り直すので、
        * 新しい並びがそのまま初期値になる。
        */}
      <WishlistScreen key={sort} initialItems={items} initialView={parseWishlistView(view)} sort={sort} back={resolveListBack(back)} />
    </ContentEnter>
  );
}
