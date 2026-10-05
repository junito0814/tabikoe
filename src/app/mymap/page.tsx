import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { PostHistoryScreen } from "@/components/mypage/PostHistoryScreen";
import { parseMyMapMode } from "@/lib/map/get-my-map-pins";
import { getMyPosts, getMyTripOptions } from "@/lib/users/my-page";
import { getMyDrafts } from "@/lib/posts/drafts";
import { ContentEnter } from "@/components/transitions/Reveal";

/**
 * SC-12 投稿履歴（#682。v3.1 の「あしあと」から改称。URL は変えていない）
 * 出典: docs/tasks/records/my-page-v4/01-post-history.md
 *       要件定義書 3.6.5・ワイヤーフレーム決定事項 72
 *
 * マイページ（SC-06）の遷移メニューから開く（4.2）。ログイン必須。
 * **一覧が既定**で、`?view=map` で地図。一覧の中身はマイページから移したもの。
 */
export default async function PostHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; view?: string }>;
}) {
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, "/mymap");
  const { mode, view } = await searchParams;
  const admin = createAdminClient();

  // 地図のときは一覧のデータを取りに行かない（開かない画面のために待たせない）
  const isMap = view === "map";
  const [initialPosts, tripOptions, drafts] = isMap
    ? [{ posts: [], nextOffset: null }, [], null]
    : await Promise.all([
        getMyPosts(admin, user.id, null, 0),
        getMyTripOptions(admin, user.id),
        // 下書きは取れなくても画面は出す
        getMyDrafts(admin, user.id).catch(() => null),
      ]);

  return (
    <ContentEnter>
      <PostHistoryScreen
        view={isMap ? "map" : "list"}
        initialPosts={initialPosts}
        tripOptions={tripOptions}
        drafts={drafts && drafts.drafts.length > 0 ? drafts : null}
        initialMapMode={parseMyMapMode(mode ?? null)}
      />
    </ContentEnter>
  );
}
