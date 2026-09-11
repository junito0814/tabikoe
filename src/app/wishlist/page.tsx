import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { WishlistScreen } from "@/components/wishlist/WishlistScreen";
import { getWishlistItems } from "@/lib/wishlist/get-wishlist-items";
import type { WishlistItem } from "@/lib/wishlist/constants";

/**
 * SC-08 「行きたい」スポット一覧画面
 * 出典: docs/tasks/records/wishlist/02-wishlist-list-screen.md
 *
 * ログイン必須（4.1）。マイページ（SC-06, Phase 7）からの導線は my-page Task4 で置く。
 */
export default async function WishlistPage() {
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, "/wishlist");

  let items: WishlistItem[] | null = null;
  try {
    items = await getWishlistItems(createAdminClient(), user.id);
  } catch {
    items = null;
  }

  if (items === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF6F0] px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  return <WishlistScreen initialItems={items} />;
}
