"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { appendBackHref } from "@/lib/search/list-state";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { NearbyPost } from "@/lib/posts/nearby-posts";
import { DEFAULT_TRAVEL_MODE, formatTravelMinutes, TRAVEL_MODE_LABELS, TRAVEL_MODES, type TravelMode } from "@/lib/geo/travel-time";

export type FetchNearbyPosts = (center: { lat: number; lng: number }, mode: TravelMode) => Promise<NearbyPost[]>;

/**
 * explore-mode Task2: 「近くのスポット」（探すモードの下 1/3。v3.1 で「近くの声」から改称）
 * 出典: docs/tasks/browsing/explore-mode/02-explore-mode-ui.md
 *       要件定義書 v3.0 3.4.5
 *
 * 【初心者向け】現在地を中心に、近い順のカードを横スクロールで並べる。
 *   - 「移動手段 ▾」（徒歩 1km／自転車 3km／車 10km。v3.2 feedback-0919 Task7）を切り替えると API を呼び直し、分数の表示も変わる
 *   - 横スクロールで真ん中に来たカード（`scroll-snap` で 1 枚ずつ止まる）を親に知らせ、地図の対応ピンを強調する（onActiveChange）
 *   - カードのタップで投稿詳細（/posts/[id]）
 * スクロール位置 → どのカードが中央か、は `scrollLeft / カード幅` で概算する（カード幅は固定）。
 */
const CARD_WIDTH = 176;
const CARD_GAP = 10;

export function NearbyVoices({
  center,
  fetchPosts = defaultFetchNearbyPosts,
  onActiveChange,
  onPostsLoaded,
  initialMode = DEFAULT_TRAVEL_MODE,
  onModeChange,
  backHref = null,
}: {
  center: { lat: number; lng: number };
  /** Bug #471: 投稿詳細から「← 地図」で探すモードに戻れるように渡す、この地図の URL */
  backHref?: string | null;
  fetchPosts?: FetchNearbyPosts;
  /** 中央に来たカードの投稿（ピンの強調用）。無ければ null */
  onActiveChange?: (post: NearbyPost | null) => void;
  onPostsLoaded?: (posts: NearbyPost[]) => void;
  initialMode?: TravelMode;
  /** v3.1: 移動手段を切り替えたとき（地図の状態の保存用） */
  onModeChange?: (mode: TravelMode) => void;
}) {
  const [mode, setMode] = useState<TravelMode>(initialMode);
  const [posts, setPosts] = useState<NearbyPost[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const onActiveChangeRef = useRef(onActiveChange);
  const onPostsLoadedRef = useRef(onPostsLoaded);
  useEffect(() => {
    onActiveChangeRef.current = onActiveChange;
    onPostsLoadedRef.current = onPostsLoaded;
  }, [onActiveChange, onPostsLoaded]);

  useEffect(() => {
    let cancelled = false;
    fetchPosts(center, mode)
      .then((result) => {
        if (cancelled) return;
        setPosts(result);
        setFailed(false);
        setActiveIndex(0);
        onPostsLoadedRef.current?.(result);
        onActiveChangeRef.current?.(result[0] ?? null);
      })
      .catch((error) => {
        if (cancelled || error instanceof UnauthorizedError) return;
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [center, mode, fetchPosts]);

  const handleScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || !posts) return;
    const index = Math.min(posts.length - 1, Math.max(0, Math.round(scroller.scrollLeft / (CARD_WIDTH + CARD_GAP))));
    if (index !== activeIndex) {
      setActiveIndex(index);
      onActiveChangeRef.current?.(posts[index] ?? null);
    }
  };

  return (
    <section aria-label="近くのスポット" data-nearby-voices className="flex h-full flex-col gap-2 bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-ink">近くのスポット</h2>
        <label className="inline-flex items-center gap-1 text-[12px] text-muted">
          移動手段
          <select
            aria-label="移動手段"
            value={mode}
            onChange={(event) => {
              const next = event.target.value as TravelMode;
              setMode(next);
              onModeChange?.(next);
            }}
            className="h-8 rounded-full border border-line bg-surface px-2 text-[12px] font-semibold text-ink"
          >
            {TRAVEL_MODES.map((option) => (
              <option key={option} value={option}>
                {TRAVEL_MODE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {failed ? (
        <p className="py-6 text-center text-[12px] text-muted">近くの投稿を読み込めませんでした</p>
      ) : posts === null ? (
        <p className="py-6 text-center text-[12px] text-muted">読み込んでいます…</p>
      ) : posts.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-muted">この範囲に投稿はありません。移動手段を変えて範囲を広げてみてください</p>
      ) : (
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="-mx-4 flex snap-x snap-mandatory gap-[10px] overflow-x-auto px-4 pb-1"
          style={{ scrollbarWidth: "none" }}
        >
          {posts.map((post, index) => (
            <Link
              key={post.id}
              href={appendBackHref(`/posts/${post.id}`, backHref)}
              data-nearby-card={post.id}
              aria-current={index === activeIndex ? "true" : undefined}
              className={`flex w-[176px] shrink-0 snap-center flex-col gap-1 rounded-[12px] border p-2.5 ${
                index === activeIndex ? "border-accent" : "border-line"
              } bg-surface`}
            >
              <span className="truncate text-[13px] font-bold text-ink">{post.spotName}</span>
              {post.commentExcerpt && <span className="line-clamp-2 text-[11px] leading-[1.5] text-muted">{post.commentExcerpt}</span>}
              <span className="mt-auto flex items-center gap-2 text-[11px] text-muted">
                <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-[6px] bg-line">
                  {post.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span data-travel-minutes>{formatTravelMinutes(post.minutes ?? post.walkMinutes, post.mode ?? mode)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

async function defaultFetchNearbyPosts(center: { lat: number; lng: number }, mode: TravelMode): Promise<NearbyPost[]> {
  const params = new URLSearchParams({ lat: String(center.lat), lng: String(center.lng), mode });
  const response = await fetchWithAuthRedirect(`/api/posts/nearby?${params.toString()}`);
  if (!response.ok) throw new Error(`Failed to fetch nearby posts: ${response.status}`);
  const data = (await response.json()) as { posts: NearbyPost[] };
  return data.posts;
}
