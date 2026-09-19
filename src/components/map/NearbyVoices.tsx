"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import {
  DEFAULT_NEARBY_RADIUS,
  NEARBY_RADIUS_LABELS,
  NEARBY_RADIUS_OPTIONS,
  type NearbyPost,
  type NearbyRadius,
} from "@/lib/posts/nearby-posts";

export type FetchNearbyPosts = (center: { lat: number; lng: number }, radius: NearbyRadius) => Promise<NearbyPost[]>;

/**
 * explore-mode Task2: 「近くのスポット」（探すモードの下 1/3。v3.1 で「近くの声」から改称）
 * 出典: docs/tasks/browsing/explore-mode/02-explore-mode-ui.md
 *       要件定義書 v3.0 3.4.5
 *
 * 【初心者向け】現在地を中心に、近い順のカードを横スクロールで並べる。
 *   - 「徒歩圏 ▾」で半径（500m／1km／3km）を切り替えると API を呼び直す
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
  initialRadius = DEFAULT_NEARBY_RADIUS,
}: {
  center: { lat: number; lng: number };
  fetchPosts?: FetchNearbyPosts;
  /** 中央に来たカードの投稿（ピンの強調用）。無ければ null */
  onActiveChange?: (post: NearbyPost | null) => void;
  onPostsLoaded?: (posts: NearbyPost[]) => void;
  initialRadius?: NearbyRadius;
}) {
  const [radius, setRadius] = useState<NearbyRadius>(initialRadius);
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
    fetchPosts(center, radius)
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
  }, [center, radius, fetchPosts]);

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
          徒歩圏
          <select
            aria-label="徒歩圏"
            value={radius}
            onChange={(event) => setRadius(Number(event.target.value) as NearbyRadius)}
            className="h-8 rounded-full border border-line bg-surface px-2 text-[12px] font-semibold text-ink"
          >
            {NEARBY_RADIUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {NEARBY_RADIUS_LABELS[option]}
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
        <p className="py-6 text-center text-[12px] text-muted">この徒歩圏に投稿はありません。範囲を広げてみてください</p>
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
              href={`/posts/${post.id}`}
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
                徒歩 {post.walkMinutes}分
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

async function defaultFetchNearbyPosts(center: { lat: number; lng: number }, radius: NearbyRadius): Promise<NearbyPost[]> {
  const params = new URLSearchParams({ lat: String(center.lat), lng: String(center.lng), radius: String(radius) });
  const response = await fetchWithAuthRedirect(`/api/posts/nearby?${params.toString()}`);
  if (!response.ok) throw new Error(`Failed to fetch nearby posts: ${response.status}`);
  const data = (await response.json()) as { posts: NearbyPost[] };
  return data.posts;
}
