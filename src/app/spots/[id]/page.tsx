import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { SpotPostListScreen } from "@/components/posts/SpotPostListScreen";
import { getSpotPostCards, parsePostSort, type PostCardPage } from "@/lib/posts/post-cards";

/**
 * SC-04 投稿カード一覧画面（スポット別）
 * 出典: docs/tasks/map-search/pin-interaction/02-post-list-ui.md
 *
 * 地図（SC-02）のピンタップから遷移する。ログイン必須（3.5.4）。
 * 1ページ目はここで取得して渡し、並び替え・追加読み込みはクライアントが GET /api/spots/[id]/posts で行う。
 */
export default async function SpotPostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, `/spots/${id}`);

  const admin = createAdminClient();
  const { data: spot } = await admin
    .from("spots")
    .select("id, name, prefecture, hidden_at")
    .eq("id", id)
    .maybeSingle();
  // F-AD-05: 非公開化されたスポットは存在しない扱い
  if (!spot || spot.hidden_at) {
    notFound();
  }

  const sort = parsePostSort((await searchParams).sort ?? null);

  let initialPage: PostCardPage | null = null;
  let isWishlisted = false;
  try {
    const [page, wishlist] = await Promise.all([
      getSpotPostCards(admin, user.id, id, sort, 0),
      admin.from("wishlist").select("id").eq("user_id", user.id).eq("spot_id", id).maybeSingle(),
    ]);
    initialPage = page;
    isWishlisted = wishlist.data !== null;
  } catch {
    initialPage = null;
  }

  if (initialPage === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  return (
    <SpotPostListScreen
      spot={{ id: spot.id, name: spot.name, prefecture: spot.prefecture, isWishlisted }}
      initialPage={initialPage}
      initialSort={sort}
    />
  );
}
