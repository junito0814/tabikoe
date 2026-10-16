"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/layout/BackLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { PullToRefresh } from "@/components/layout/PullToRefresh";
import { PostCard } from "@/components/posts/PostCard";
import { ViewToggle } from "@/components/posts/ViewToggle";
import { PhotoGrid, type FetchMediaPage } from "@/components/media/PhotoGrid";
import { Select } from "@/components/ui/Select";
import { useInfiniteScroll } from "@/components/posts/use-infinite-scroll";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { LIST_SORTS, listSortLabel, type ListSort } from "@/lib/records/list-sort";
import type { PostCardPage } from "@/lib/posts/post-cards";
import type { SpotMediaPage } from "@/lib/posts/search-photos";

/**
 * SC-34 いいねした投稿（#954）
 * 出典: Issue #954、要件定義書 3.6.6、ワイヤーフレーム決定事項 98
 *
 * 【初心者向け】いままで ♡ は「押せるだけ」で、押したものを見返す場所がありませんでした。
 * アカウント画面（SC-07）の行から、この画面に入ります。
 *
 * 形は「行きたい」「アルバム」「投稿履歴」と同じ（約束 14）。
 *   1 行目: ‹ アカウント
 *   2 行目: 見出し「いいねした投稿」と、右に件数
 *   3 行目: 投稿／写真 の切替（左）と、並び替え（右）
 *
 * **並びは「♡ を押した順」**で、投稿の新着順ではありません。表示（投稿／写真）と並び順はどちらも
 * URL に持ちます（`?view=photos&sort=oldest`）。state だけに持つと、投稿詳細から戻ったときに消えます。
 */
export type LikedPostsView = "posts" | "photos";

export function LikedPostsScreen({
  view,
  sort,
  totalCount,
  initialPage,
  initialMediaPage,
  fetchPosts = defaultFetchLikedPosts,
  fetchPhotos = defaultFetchLikedPhotos,
}: {
  view: LikedPostsView;
  sort: ListSort;
  /** 見出しの右に出す件数（いま見られるものだけ。一覧と必ず一致する） */
  totalCount: number;
  initialPage: PostCardPage;
  initialMediaPage: SpotMediaPage;
  /** 差し替え口（単体テスト用） */
  fetchPosts?: (sort: ListSort, offset: number) => Promise<PostCardPage>;
  /** 差し替え口（単体テスト用） */
  fetchPhotos?: (sort: ListSort, params: URLSearchParams) => Promise<SpotMediaPage>;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPage.posts);
  const [nextOffset, setNextOffset] = useState(initialPage.nextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hrefFor = (nextView: LikedPostsView, nextSort: ListSort) => {
    const params = new URLSearchParams();
    if (nextView === "photos") params.set("view", "photos");
    if (nextSort !== "newest") params.set("sort", nextSort);
    const query = params.toString();
    return `/likes${query ? `?${query}` : ""}`;
  };

  const loadMore = async () => {
    if (isLoading || nextOffset === null) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const page = await fetchPosts(sort, nextOffset);
      setPosts((current) => [...current, ...page.posts]);
      setNextOffset(page.nextOffset);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage(ERROR_MESSAGES.dbLoadFailure);
    } finally {
      setIsLoading(false);
    }
  };

  const sentinelRef = useInfiniteScroll(nextOffset !== null && !isLoading, loadMore);

  /*
   * 写真側は検索・アルバムと同じ PhotoGrid。違いは「どこから取るか」だけなので、
   * fetchPage を /api/likes/photos に向けた関数に差し替えて渡す（約束 14）。
   */
  const fetchPage = useMemo<FetchMediaPage>(() => (params) => fetchPhotos(sort, params), [fetchPhotos, sort]);
  const photoParams = useMemo(() => new URLSearchParams(), []);

  const header = (
    <header className="flex flex-col gap-2">
      <BackLink href="/account" label="アカウント" />
      <div className="flex items-baseline gap-2">
        <h1 className="flex-1 text-[1.125rem] font-bold text-ink">いいねした投稿</h1>
        <span className="text-[0.75rem] text-muted">{totalCount} 件</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <ViewToggle value={view} onChange={(next) => router.replace(hrefFor(next === "photos" ? "photos" : "posts", sort), { scroll: false })} />
        {/* #954: 並びは 2 つだけ。言葉は listSortLabel から作る（「いいね」を基準に）。約束 14 */}
        <Select<ListSort>
          value={sort}
          onChange={(next) => router.replace(hrefFor(view, next), { scroll: false })}
          options={LIST_SORTS}
          label={(option) => listSortLabel(option, "いいね")}
          ariaLabel="並び替え"
        />
      </div>
    </header>
  );

  return (
    <PullToRefresh>
      <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
        <div className="flex w-full max-w-[560px] flex-col gap-4">
          {header}

          {totalCount === 0 ? (
            /* #800: 空の画面には「どうすれば増えるか」を書く（要件 4.5.12） */
            <EmptyState
              title="まだいいねした投稿がありません"
              description="気になった投稿の ♡ を押すと、ここにたまります"
              action={{ label: "投稿を探す", href: "/" }}
            />
          ) : view === "photos" ? (
            <PhotoGrid params={photoParams} initialPage={initialMediaPage} fetchPage={fetchPage} backHref={hrefFor("photos", sort)} />
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {posts.map((post) => (
                  <li key={post.id}>
                    {/* いいねした投稿は**他の人の投稿**なので、スポット名も投稿者名も出す（自分の投稿一覧と違う点） */}
                    <PostCard post={post} backHref={hrefFor("posts", sort)} />
                  </li>
                ))}
              </ul>
              {errorMessage && <ErrorNotice message={errorMessage} retryable onRetry={loadMore} />}
              {nextOffset !== null && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isLoading}
                  className="tap-target mx-auto h-10 rounded-full border border-line bg-surface px-5 text-[0.8125rem] font-semibold text-ink disabled:opacity-50"
                >
                  {isLoading ? "読み込んでいます…" : "もっと見る"}
                </button>
              )}
              <div ref={sentinelRef} />
            </>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}

async function defaultFetchLikedPosts(sort: ListSort, offset: number): Promise<PostCardPage> {
  const response = await fetchWithAuthRedirect(`/api/likes/posts?sort=${sort}&offset=${offset}`);
  if (!response.ok) throw new Error(`Failed to fetch liked posts: ${response.status}`);
  return (await response.json()) as PostCardPage;
}

async function defaultFetchLikedPhotos(sort: ListSort, params: URLSearchParams): Promise<SpotMediaPage> {
  const query = new URLSearchParams(params);
  query.set("sort", sort);
  const response = await fetchWithAuthRedirect(`/api/likes/photos?${query.toString()}`);
  if (!response.ok) throw new Error(`Failed to fetch liked photos: ${response.status}`);
  return (await response.json()) as SpotMediaPage;
}
