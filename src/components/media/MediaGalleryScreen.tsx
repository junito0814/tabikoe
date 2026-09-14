"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { SpotMediaItem, SpotMediaPage } from "@/lib/posts/spot-photos";
import { useInfiniteScroll } from "@/components/posts/use-infinite-scroll";
import { MediaThumbnail } from "./MediaGrid";
import { MediaViewerModal } from "./MediaViewerModal";
import { gridColumnsForWidth, MIN_GALLERY_COLUMNS } from "./gallery-columns";

/** 追加読み込み。offset から1ページ返す */
export type FetchMediaPage = (offset: number) => Promise<SpotMediaPage>;

/**
 * 写真・動画一覧の共通画面（スポット写真一覧 SC-13、アルバム写真一覧 SC-21）
 * 出典: docs/tasks/map-search/spot-photo-gallery/02-gallery-screen-ui.md
 *       docs/tasks/records/album-photos/02-album-photos-screen.md
 *
 * 正方形サムネイルのグリッド。列数はコンテナ幅から決める（gridColumnsForWidth）。
 * 動画は shared-ui/media-layout の MediaThumbnail で再生アイコンを重ねる。
 * サムネイルのタップで MediaViewerModal を開き、読み込み済みの全点を ←→ で行き来できる
 * （media-viewer Task3、4.5.5）。元投稿（SC-05）への導線はモーダル内に置く。40点ずつの無限スクロール。
 * 見出し・戻り先・取得元は呼び出し側（SpotPhotoGalleryScreen / AlbumPhotoGalleryScreen）が決める。
 */
export function MediaGalleryScreen({
  title,
  backLink,
  initialPage,
  fetchPage,
}: {
  title: string;
  backLink: { href: string; label: string };
  initialPage: SpotMediaPage;
  fetchPage: FetchMediaPage;
}) {
  const [items, setItems] = useState<SpotMediaItem[]>(initialPage.items);
  const [nextOffset, setNextOffset] = useState<number | null>(initialPage.nextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [columns, setColumns] = useState(MIN_GALLERY_COLUMNS);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
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
      const page = await fetchPage(nextOffset);
      setItems((current) => [...current, ...page.items]);
      setNextOffset(page.nextOffset);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage(ERROR_MESSAGES.dbLoadFailure);
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, isLoading, nextOffset]);

  const sentinelRef = useInfiniteScroll(nextOffset !== null && !isLoading, () => void loadMore());

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#FBF6F0] px-4 py-6">
      <div className="w-full max-w-[760px]">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-[18px] font-bold text-[#3D3A35]">{title}</h1>
            <p className="mt-0.5 text-[11px] text-[#9C9488]">写真・動画</p>
          </div>
          <Link
            href={backLink.href}
            className="shrink-0 text-[12px] font-medium text-[#9C9488] underline underline-offset-2"
          >
            {backLink.label}
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
              {items.map((item, index) => (
                <li key={item.id} className="aspect-square overflow-hidden bg-[#E8E1D8]">
                  <button
                    type="button"
                    onClick={() => setViewerIndex(index)}
                    className="block h-full w-full"
                    aria-label={item.alt}
                  >
                    <MediaThumbnail item={item} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {errorMessage && <ErrorNotice className="mt-3" message={errorMessage} onRetry={() => void loadMore()} />}

        {viewerIndex !== null && (
          <MediaViewerModal
            items={items.map((item) => ({
              id: item.id,
              mediaType: item.mediaType,
              thumbnailUrl: item.thumbnailUrl,
              alt: item.alt,
              videoUrl: item.videoUrl ?? undefined,
            }))}
            index={viewerIndex}
            onIndexChange={setViewerIndex}
            onClose={() => setViewerIndex(null)}
            link={(_item, index) => ({ href: `/posts/${items[index].postId}`, label: "この投稿を見る" })}
          />
        )}

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
