"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { MyPost, MyPostsPage } from "@/lib/users/my-page";
import { useInfiniteScroll } from "@/components/posts/use-infinite-scroll";

export type FetchMyPosts = (tripId: string | null, offset: number) => Promise<MyPostsPage>;

/**
 * F-RC-01 Task3 / trip-title Task5: 自分の投稿一覧（旅行タイトル表示・旅行で絞り込み）
 * 出典: docs/tasks/records/my-page/03-my-posts-list-handler.md
 *       docs/tasks/posts/trip-title/05-display-scope-control.md
 */
export function MyPostsList({
  initialPage,
  tripOptions,
  fetchPosts = defaultFetchPosts,
}: {
  initialPage: MyPostsPage;
  tripOptions: { id: string; title: string }[];
  /** 差し替え口（単体テスト用） */
  fetchPosts?: FetchMyPosts;
}) {
  const [tripId, setTripId] = useState<string | null>(null);
  const [posts, setPosts] = useState<MyPost[]>(initialPage.posts);
  const [nextOffset, setNextOffset] = useState<number | null>(initialPage.nextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (nextTripId: string | null, offset: number, replace: boolean) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const page = await fetchPosts(nextTripId, offset);
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
    [fetchPosts]
  );

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void load(tripId, 0, true);
  }, [tripId, load]);

  const loadMore = useCallback(() => {
    if (isLoading || nextOffset === null) return;
    void load(tripId, nextOffset, false);
  }, [isLoading, nextOffset, load, tripId]);

  const sentinelRef = useInfiniteScroll(nextOffset !== null && !isLoading, loadMore);

  return (
    <section aria-labelledby="my-posts-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="my-posts-heading" className="text-[14px] font-bold text-[#3D3A35]">自分の投稿</h2>
        <select
          value={tripId ?? ""}
          onChange={(event) => setTripId(event.target.value || null)}
          aria-label="旅行で絞り込み"
          className="h-9 max-w-[200px] rounded-[8px] border border-[#E8E1D8] bg-white px-2 text-[12px] text-[#3D3A35]"
        >
          <option value="">すべての旅行</option>
          {tripOptions.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.title}
            </option>
          ))}
        </select>
      </div>

      {posts.length === 0 && !isLoading ? (
        <p className="py-10 text-center text-[13px] text-[#9C9488]">まだ投稿がありません</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/posts/${post.id}`}
                className="flex gap-3 rounded-[12px] border border-[#E8E1D8] bg-white p-2.5"
                data-my-post={post.id}
              >
                <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-[8px] bg-[#E8E1D8]">
                  {post.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[11px] font-medium text-[#C4703F]" data-trip-title>
                    {post.tripTitle}
                  </span>
                  <span className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-[#3D3A35]">
                    {post.spotName}
                    {post.visibility === "private" && (
                      <span className="rounded-full bg-[#E8E1D8] px-1.5 py-0.5 text-[10px] font-medium">非公開</span>
                    )}
                  </span>
                  <span className="text-[11px] text-[#9C9488]">
                    {post.category} ・ {new Date(post.createdAt).toLocaleDateString("ja-JP")} ・ ♥ {post.likeCount}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {errorMessage && <ErrorNotice message={errorMessage} onRetry={() => void load(tripId, posts.length === 0 ? 0 : (nextOffset ?? 0), posts.length === 0)} />}

      <div ref={sentinelRef} aria-hidden className="h-1" />
      {nextOffset !== null && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isLoading}
          className="h-10 w-full rounded-[10px] border border-[#E8E1D8] bg-white text-[13px] font-semibold text-[#3D3A35] disabled:opacity-45"
        >
          {isLoading ? "読み込み中…" : "もっと見る"}
        </button>
      )}
    </section>
  );
}

async function defaultFetchPosts(tripId: string | null, offset: number): Promise<MyPostsPage> {
  const params = new URLSearchParams({ offset: String(offset) });
  if (tripId) params.set("trip_id", tripId);
  const response = await fetchWithAuthRedirect(`/api/users/me/posts?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch my posts: ${response.status}`);
  }
  return (await response.json()) as MyPostsPage;
}
