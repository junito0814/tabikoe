"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { ReportLink } from "@/components/reports/ReportLink";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import {
  POST_SORT_LABELS,
  POST_SORTS,
  type PostCardData,
  type PostCardPage,
  type PostSort,
} from "@/lib/posts/post-cards";
import { PostCard } from "./PostCard";
import { useInfiniteScroll } from "./use-infinite-scroll";

export interface SpotSummary {
  id: string;
  name: string;
  prefecture: string | null;
  isWishlisted: boolean;
}

export type FetchSpotPosts = (spotId: string, sort: PostSort, offset: number) => Promise<PostCardPage>;

/**
 * F-MP-03 Task2〜3: 投稿カード一覧画面（SC-04・スポット別）
 * F-MP-05 Task3: 「写真」タグ導線（SC-13へ）
 * F-RC-05 Task3: 「行きたい」保存ボタンの組み込み
 * 出典: docs/tasks/map-search/pin-interaction/02-post-list-ui.md
 *       docs/tasks/map-search/spot-photo-gallery/03-photo-tag-entry-point.md
 *       docs/tasks/records/wishlist/03-wishlist-entry-points-ui.md
 *
 * 地図のピンタップから開く。並び替えを変えると先頭から取り直す。投稿が無ければ「まだ投稿がありません」。
 */
export function SpotPostListScreen({
  spot,
  initialPage,
  initialSort = "newest",
  fetchPosts = defaultFetchPosts,
}: {
  spot: SpotSummary;
  initialPage: PostCardPage;
  initialSort?: PostSort;
  /** 差し替え口（単体テスト用） */
  fetchPosts?: FetchSpotPosts;
}) {
  const [sort, setSort] = useState<PostSort>(initialSort);
  const [posts, setPosts] = useState<PostCardData[]>(initialPage.posts);
  const [nextOffset, setNextOffset] = useState<number | null>(initialPage.nextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (nextSort: PostSort, offset: number, replace: boolean) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const page = await fetchPosts(spot.id, nextSort, offset);
        if (requestIdRef.current !== requestId) return;
        setPosts((current) => (replace ? page.posts : [...current, ...page.posts]));
        setNextOffset(page.nextOffset);
      } catch (error) {
        if (error instanceof UnauthorizedError) return;
        if (requestIdRef.current !== requestId) return;
        setErrorMessage(ERROR_MESSAGES.dbLoadFailure);
      } finally {
        if (requestIdRef.current === requestId) setIsLoading(false);
      }
    },
    [fetchPosts, spot.id]
  );

  // 並び替えの変更時は先頭から取り直す（初期表示は Server Component が渡した1ページ目を使う）
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void load(sort, 0, true);
  }, [sort, load]);

  const loadMore = useCallback(() => {
    if (isLoading || nextOffset === null) return;
    void load(sort, nextOffset, false);
  }, [isLoading, nextOffset, load, sort]);

  const sentinelRef = useInfiniteScroll(nextOffset !== null && !isLoading, loadMore);

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#FBF6F0] px-4 py-6">
      <div className="w-full max-w-[520px]">
        <header className="mb-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-[18px] font-bold text-[#3D3A35]">{spot.name}</h1>
              <p className="mt-0.5 text-[11px] text-[#9C9488]">{spot.prefecture ?? "都道府県未設定"}</p>
            </div>
            <WishlistButton spotId={spot.id} initialSaved={spot.isWishlisted} className="shrink-0" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* F-MP-05 Task3: 「写真」タグ → SC-13 */}
            <Link
              href={`/spots/${spot.id}/photos`}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-[#E8E1D8] bg-white px-3 text-[12px] font-semibold text-[#3D3A35]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="9" cy="10" r="1.8" fill="currentColor" />
                <path d="M4 17l5-5 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
              写真
            </Link>
            <Link
              href="/map"
              className="inline-flex h-8 items-center rounded-full border border-[#E8E1D8] bg-white px-3 text-[12px] font-semibold text-[#3D3A35]"
            >
              地図へ戻る
            </Link>
            <ReportLink targetType="spot" targetId={spot.id} returnTo={`/spots/${spot.id}`} />
          </div>

          <div role="radiogroup" aria-label="並び替え" className="flex gap-1.5">
            {POST_SORTS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={sort === option}
                onClick={() => setSort(option)}
                className={`h-8 rounded-full px-3 text-[12px] font-semibold ${
                  sort === option ? "bg-[#3D3A35] text-white" : "bg-white text-[#9C9488] border border-[#E8E1D8]"
                }`}
              >
                {POST_SORT_LABELS[option]}
              </button>
            ))}
          </div>
        </header>

        {posts.length === 0 && !isLoading ? (
          <p className="py-16 text-center text-[13px] text-[#9C9488]">まだ投稿がありません</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        )}

        {errorMessage && (
          <ErrorNotice className="mt-3" message={errorMessage} onRetry={() => void load(sort, posts.length === 0 ? 0 : (nextOffset ?? 0), posts.length === 0)} />
        )}

        <div ref={sentinelRef} aria-hidden className="h-1" />
        {nextOffset !== null && (
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoading}
            className="mt-3 h-10 w-full rounded-[10px] border border-[#E8E1D8] bg-white text-[13px] font-semibold text-[#3D3A35] disabled:opacity-45"
          >
            {isLoading ? "読み込み中…" : "もっと見る"}
          </button>
        )}
      </div>
    </div>
  );
}

async function defaultFetchPosts(spotId: string, sort: PostSort, offset: number): Promise<PostCardPage> {
  const params = new URLSearchParams({ sort, offset: String(offset) });
  const response = await fetchWithAuthRedirect(`/api/spots/${spotId}/posts?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch posts: ${response.status}`);
  }
  return (await response.json()) as PostCardPage;
}
