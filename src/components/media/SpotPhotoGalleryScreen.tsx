"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { SpotMediaItem, SpotMediaPage } from "@/lib/posts/spot-photos";
import { useInfiniteScroll } from "@/components/posts/use-infinite-scroll";
import { MediaThumbnail } from "./MediaGrid";
import { gridColumnsForWidth, MIN_GALLERY_COLUMNS } from "./gallery-columns";

export type FetchSpotMedia = (spotId: string, offset: number) => Promise<SpotMediaPage>;

/**
 * F-MP-05 Task2・Task4: スポット写真一覧画面（SC-13）
 * 出典: docs/tasks/map-search/spot-photo-gallery/02-gallery-screen-ui.md
 *       docs/tasks/map-search/spot-photo-gallery/04-post-detail-navigation.md
 *
 * 正方形サムネイルのグリッド。列数はコンテナ幅から決める（gridColumnsForWidth）。
 * 動画は shared-ui/media-layout の MediaThumbnail で再生アイコンを重ねる。
 * 各サムネイルは元投稿の詳細（SC-05、/posts/[id]）へのリンク。40点ずつの無限スクロール。
 */
export function SpotPhotoGalleryScreen({
  spot,
  initialPage,
  fetchMedia = defaultFetchMedia,
}: {
  spot: { id: string; name: string };
  initialPage: SpotMediaPage;
  /** 差し替え口（単体テスト用） */
  fetchMedia?: FetchSpotMedia;
}) {
  const [items, setItems] = useState<SpotMediaItem[]>(initialPage.items);
  const [nextOffset, setNextOffset] = useState<number | null>(initialPage.nextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [columns, setColumns] = useState(MIN_GALLERY_COLUMNS);
  const containerRef = useRef<HTMLDivElement>(null);

  // コンテナ幅の変化に追従して列数を決める
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => setColumns(gridColumnsForWidth(element.clientWidth));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoading || nextOffset === null) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const page = await fetchMedia(spot.id, nextOffset);
      setItems((current) => [...current, ...page.items]);
      setNextOffset(page.nextOffset);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage(ERROR_MESSAGES.dbLoadFailure);
    } finally {
      setIsLoading(false);
    }
  }, [fetchMedia, isLoading, nextOffset, spot.id]);

  const sentinelRef = useInfiniteScroll(nextOffset !== null && !isLoading, () => void loadMore());

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#FBF6F0] px-4 py-6">
      <div className="w-full max-w-[760px]">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-[18px] font-bold text-[#3D3A35]">{spot.name}</h1>
            <p className="mt-0.5 text-[11px] text-[#9C9488]">写真・動画</p>
          </div>
          <Link
            href={`/spots/${spot.id}`}
            className="shrink-0 text-[12px] font-medium text-[#9C9488] underline underline-offset-2"
          >
            投稿一覧へ
          </Link>
        </header>

        <div ref={containerRef} data-columns={columns}>
          {items.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-[#9C9488]">まだ写真・動画がありません</p>
          ) : (
            <ul
              className="grid gap-0.5"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {items.map((item) => (
                <li key={item.id} className="aspect-square overflow-hidden bg-[#E8E1D8]">
                  <Link href={`/posts/${item.postId}`} className="block h-full w-full" aria-label={item.alt}>
                    <MediaThumbnail item={item} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {errorMessage && <ErrorNotice className="mt-3" message={errorMessage} onRetry={() => void loadMore()} />}

        <div ref={sentinelRef} aria-hidden className="h-1" />
        {nextOffset !== null && (
          <button
            type="button"
            onClick={() => void loadMore()}
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

async function defaultFetchMedia(spotId: string, offset: number): Promise<SpotMediaPage> {
  const response = await fetchWithAuthRedirect(`/api/spots/${spotId}/photos?offset=${offset}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch spot media: ${response.status}`);
  }
  return (await response.json()) as SpotMediaPage;
}
