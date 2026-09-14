"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import type { MediaItem } from "./MediaGrid";

/** スワイプとみなす横移動の最小距離（px） */
const SWIPE_THRESHOLD_PX = 50;

/**
 * 写真・動画ビューア Task1: MediaViewerModal 共通コンポーネント
 * 出典: docs/tasks/shared-ui/media-viewer/01-media-viewer-modal.md
 *       要件定義書4.5.5（写真・動画のモーダル表示）、7.7（キーボード操作）
 *
 * 写真・動画をタップした画面（SC-04/05/06/09/13）が共通で開く全画面モーダル。
 * 複数点あれば ←→ ボタン・矢印キー・左右スワイプで前後に移動できる。端では止まる（ループしない）。
 * 動画はモーダル内で再生する（4.5.1 のインライン再生を置き換え）。
 * 表示する `items` の署名付きURLは呼び出し側が用意する（本コンポーネントは取得しない）。
 */
export function MediaViewerModal({
  items,
  index,
  onIndexChange,
  onClose,
  link,
}: {
  items: MediaItem[];
  /** 表示中の位置（0始まり） */
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** モーダル内に置く導線（例: スポット写真一覧から元の投稿へ）。位置ごとに変えられる */
  link?: (item: MediaItem, index: number) => { href: string; label: string } | null;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);

  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onIndexChange(index - 1);
  }, [hasPrev, index, onIndexChange]);
  const goNext = useCallback(() => {
    if (hasNext) onIndexChange(index + 1);
  }, [hasNext, index, onIndexChange]);

  // 矢印キーで前後、Esc で閉じる（7.7）。背面のページのスクロールは止める
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") goPrev();
      else if (event.key === "ArrowRight") goNext();
      else if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [goNext, goPrev, onClose]);

  const item = items[index];
  if (!item) return null;

  const currentLink = link?.(item, index) ?? null;

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (deltaX <= -SWIPE_THRESHOLD_PX) goNext();
    else if (deltaX >= SWIPE_THRESHOLD_PX) goPrev();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="写真・動画"
      className="fixed inset-0 z-[60] flex flex-col bg-black/95 text-white"
      onClick={onClose}
      data-media-viewer
    >
      <div className="flex items-center justify-between px-4 py-3" onClick={(event) => event.stopPropagation()}>
        <span className="text-[13px] font-medium tabular-nums" data-media-viewer-position>
          {index + 1} / {items.length}
        </span>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="flex h-10 w-10 items-center justify-center rounded-full text-[22px] leading-none hover:bg-white/10"
        >
          ×
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {item.mediaType === "video" && item.videoUrl ? (
          <video
            key={item.id}
            src={item.videoUrl}
            controls
            autoPlay
            playsInline
            aria-label={item.alt}
            onClick={(event) => event.stopPropagation()}
            className="max-h-full max-w-full"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.id}
            src={item.thumbnailUrl}
            alt={item.alt}
            onClick={(event) => event.stopPropagation()}
            className="max-h-full max-w-full object-contain"
          />
        )}

        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goPrev();
              }}
              disabled={!hasPrev}
              aria-label="前へ"
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-[22px] leading-none disabled:opacity-30"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goNext();
              }}
              disabled={!hasNext}
              aria-label="次へ"
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-[22px] leading-none disabled:opacity-30"
            >
              ›
            </button>
          </>
        )}
      </div>

      <div className="flex min-h-12 items-center justify-center px-4 py-3" onClick={(event) => event.stopPropagation()}>
        {currentLink && (
          <Link
            href={currentLink.href}
            className="text-[13px] font-medium text-white underline underline-offset-2"
          >
            {currentLink.label}
          </Link>
        )}
      </div>
    </div>
  );
}
