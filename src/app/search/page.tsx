import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { PostSearchScreen } from "@/components/posts/PostSearchScreen";
import type { PostCardPage } from "@/lib/posts/post-cards";
import { parsePostSearchParams, searchPostCards } from "@/lib/posts/search-posts";

/**
 * SC-04 投稿カード一覧画面（検索・絞り込みモード）
 * 出典: docs/tasks/map-search/post-filter/02-filter-ui.md
 *
 * 全体マップ（SC-02）の「投稿を検索」から、地図の中心座標（lat/lng）を伴って遷移する。
 * 距離の絞り込みはこの座標を基準にする（3.4.4）。座標なしで開いた場合は距離条件を使えない。
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ lat?: string; lng?: string }>;
}) {
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, "/search");

  const { lat, lng } = await searchParams;
  const latNumber = Number(lat);
  const lngNumber = Number(lng);
  const center =
    lat !== undefined && lng !== undefined && Number.isFinite(latNumber) && Number.isFinite(lngNumber)
      ? { lat: latNumber, lng: lngNumber }
      : null;

  // 条件なし（新着順）の1ページ目。以降の検索・追加読み込みはクライアントが GET /api/posts/search で行う
  let initialPage: PostCardPage | null = null;
  try {
    initialPage = await searchPostCards(
      createAdminClient(),
      user.id,
      parsePostSearchParams(new URLSearchParams()),
      0
    );
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

  return <PostSearchScreen center={center} initialPage={initialPage} />;
}
