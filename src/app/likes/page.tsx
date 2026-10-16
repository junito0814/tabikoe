import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { ContentEnter } from "@/components/transitions/Reveal";
import { LikedPostsScreen } from "@/components/likes/LikedPostsScreen";
import { countLikedPosts, getLikedMediaPage, getLikedPostCards } from "@/lib/likes/liked-posts";
import { parseListSort } from "@/lib/records/list-sort";
import type { PostCardPage } from "@/lib/posts/post-cards";
import type { SpotMediaPage } from "@/lib/posts/search-photos";

// #785: ブラウザのタブ名（「いいねした投稿 | タビコエ」）
export const metadata = { title: "いいねした投稿" };

/**
 * SC-34 いいねした投稿（#954）
 * 出典: Issue #954、要件定義書 3.6.6
 *
 * 【初心者向け】**本人だけ**が見る画面なので、ログイン必須（4.1）で、見るのは必ず自分のいいね。
 * 他人のプロフィール（SC-33）からは辿れません（URL に user を取らないので、そもそも指定できない）。
 *
 * 表示（投稿／写真）と並び順は URL に持ちます。写真側の 1 ページ目も**ここで**取っておくので、
 * 「写真」に切り替えた瞬間に空のグリッドが出ることはありません。
 */
export default async function LikedPostsPage({ searchParams }: { searchParams: Promise<{ view?: string; sort?: string }> }) {
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, "/likes");
  const { view, sort: sortParam } = await searchParams;
  const sort = parseListSort(sortParam);
  const isPhotos = view === "photos";

  const admin = createAdminClient();
  // 失敗したら null にして、JSX は try の外で組み立てる（try の中の JSX は描画時の例外を拾えないため）
  let loaded: { totalCount: number; initialPage: PostCardPage; initialMediaPage: SpotMediaPage } | null = null;
  try {
    const [totalCount, initialPage, initialMediaPage] = await Promise.all([
      countLikedPosts(admin, user.id),
      getLikedPostCards(admin, user.id, sort, 0),
      getLikedMediaPage(admin, user.id, sort, 0),
    ]);
    loaded = { totalCount, initialPage, initialMediaPage };
  } catch {
    loaded = null;
  }

  if (loaded === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  return (
    <ContentEnter>
      {/*
        * #863 と同じ手: `key` に表示と並び順を入れて、変わったら部品を作り直す。
        * 一覧は `useState(initialPage.posts)` に持っているので、初期値を入れ直さないと古い並びのまま残る。
        */}
      <LikedPostsScreen
        key={`${isPhotos ? "photos" : "posts"}-${sort}`}
        view={isPhotos ? "photos" : "posts"}
        sort={sort}
        totalCount={loaded.totalCount}
        initialPage={loaded.initialPage}
        initialMediaPage={loaded.initialMediaPage}
      />
    </ContentEnter>
  );
}
