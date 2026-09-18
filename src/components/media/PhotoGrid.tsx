"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { SpotMediaItem, SpotMediaPage } from "@/lib/posts/search-photos";
import { useInfiniteScroll } from "@/components/posts/use-infinite-scroll";
import { MediaModal } from "./MediaModal";
import { MediaThumbnail, type MediaItem } from "./MediaGrid";
import { gridColumnsForWidth, MIN_GALLERY_COLUMNS } from "./gallery-columns";

export type FetchMediaPage = (params: URLSearchParams) => Promise<SpotMediaPage>;

/**
 * F-MP-05 Task2・Task4 / photo-view Task2（v3.0）: 写真・動画のグリッド（投稿一覧の「写真」切替）
 * 出典: docs/tasks/map-search/spot-photo-gallery/02-gallery-screen-ui.md
 *       docs/tasks/map-search/photo-view/02-view-toggle-ui.md
 *
 * 【初心者向け】正方形サムネイルのグリッド。列数は CSS のメディアクエリではなく `ResizeObserver` でコンテナの幅を測って
 * 決める（gridColumnsForWidth）。サイドバーの有無で幅が変わっても正しい列数になる。
 * タップで MediaModal（← → で前後、「この投稿を見る」で投稿詳細）。40 点ずつの無限スクロール。
 * `params` は投稿一覧と同じ検索条件（行き先・絞り込み・並び替え）で、`offset` だけここで足す。
 */
export function PhotoGrid({
  params,
  initialPage,
  fetchPage = defaultFetchMediaPage,
}: {
  /** 投稿一覧と同じ検索条件（offset は含めない） */
  params: URLSearchParams;
  initialPage: SpotMediaPage;
  /** 差し替え口（単体テスト用） */
  fetchPage?: FetchMediaPage;
}) {
  const [items, setItems] = useState<SpotMediaItem[]>(initialPage.items);
  const [nextOffset, setNextOffset] = useState<number | null>(initialPage.nextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [columns, setColumns] = useState(MIN_GALLERY_COLUMNS);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const paramsKey = params.toString();

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
      const query = new URLSearchParams(paramsKey);
      query.set("offset", String(nextOffset));
      const page = await fetchPage(query);
      setItems((current) => [...current, ...page.items]);
      setNextOffset(page.nextOffset);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage(ERROR_MESSAGES.dbLoadFailure);
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, isLoading, nextOffset, paramsKey]);

  const sentinelRef = useInfiniteScroll(nextOffset !== null && !isLoading, () => void loadMore());

  const modalItems: MediaItem[] = items.map((item) => ({
    id: item.id,
    mediaType: item.mediaType,
    thumbnailUrl: item.thumbnailUrl,
    alt: item.alt,
    videoUrl: item.videoUrl ?? undefined,
  }));
  const postHrefOf = (media: MediaItem) => {
    const postId = items.find((item) => item.id === media.id)?.postId;
    return postId ? `/posts/${postId}` : undefined;
  };

  return (
    <div data-photo-grid>
      <div ref={containerRef} data-columns={columns}>
        {items.length === 0 ? (
          // 1 ページ目が未取得（nextOffset が 0）のときは番兵が見えて自動で読み込む
          <p className="py-16 text-center text-[13px] text-muted">{nextOffset !== null ? "読み込んでいます…" : "まだ写真・動画がありません"}</p>
        ) : (
          <ul className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {items.map((item, index) => (
              <li key={item.id} className="aspect-square overflow-hidden bg-line">
                <button type="button" onClick={() => setOpenIndex(index)} className="block h-full w-full" aria-label={item.alt}>
                  <MediaThumbnail item={item} />
                </button>
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
          className="mt-3 h-10 w-full rounded-[10px] border border-line bg-surface text-[13px] font-semibold text-ink disabled:opacity-45"
        >
          {isLoading ? "読み込み中…" : "もっと見る"}
        </button>
      )}

      {openIndex !== null && <MediaModal items={modalItems} startIndex={openIndex} onClose={() => setOpenIndex(null)} postHref={postHrefOf} />}
    </div>
  );
}

async function defaultFetchMediaPage(params: URLSearchParams): Promise<SpotMediaPage> {
  const response = await fetchWithAuthRedirect(`/api/posts/photos?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch media: ${response.status}`);
  }
  return (await response.json()) as SpotMediaPage;
}
