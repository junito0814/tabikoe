"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { MediaItem } from "./MediaGrid";

/**
 * media-layout-v3 Task1: 写真・動画モーダル（全画面共通）
 * 出典: docs/tasks/shared-ui/media-layout-v3/01-media-modal.md
 *       要件定義書 v3.0 4.5.1（モーダル表示）
 *
 * 【初心者向け】写真をタップしたら、その写真から始まるフルスクリーンの閲覧画面を出す部品。
 *   - 左右スワイプ・←→ボタン・矢印キーで前後へ。端では止まる
 *   - 動画はモーダルの中で再生する（controls 付き）
 *   - Escape か背景のクリックで閉じる。開いている間は body のスクロールを止める
 *   - `postHref` を渡すと「この投稿を見る」リンクを出す（投稿一覧の写真切替から使う）
 * 位置（index）は state で持ち、items の範囲外にならないよう clamp する。
 */
export function MediaModal({
  items,
  startIndex = 0,
  onClose,
  postHref,
  postHrefLabel = "この投稿を見る",
}: {
  items: MediaItem[];
  startIndex?: number;
  onClose: () => void;
  /** 元の投稿へのリンク（投稿一覧の写真切替から開いたとき） */
  postHref?: string | ((item: MediaItem) => string | undefined);
  postHrefLabel?: string;
}) {
  const [index, setIndex] = useState(() => Math.min(Math.max(startIndex, 0), Math.max(items.length - 1, 0)));
  const touchStartX = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;
  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setIndex((i) => Math.min(items.length - 1, i + 1)), [items.length]);

  // キーボード操作と body のスクロール固定
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") goPrev();
      else if (event.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, goPrev, goNext]);

  const item = items[index];
  if (!item) return null;
  const href = typeof postHref === "function" ? postHref(item) : postHref;
  const fullUrl = item.fullUrl ?? item.thumbnailUrl;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.alt}
      ref={dialogRef}
      tabIndex={-1}
      data-media-modal
      className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white outline-none"
      onClick={onClose}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start === null) return;
        const delta = (event.changedTouches[0]?.clientX ?? start) - start;
        if (delta > 40) goPrev();
        else if (delta < -40) goNext();
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-[12px]" onClick={(event) => event.stopPropagation()}>
        <span aria-live="polite">
          {index + 1} / {items.length}
        </span>
        <button type="button" onClick={onClose} aria-label="閉じる" className="h-9 rounded-full bg-white/15 px-3 text-[13px] font-semibold">
          閉じる
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2" onClick={(event) => event.stopPropagation()}>
        {item.mediaType === "video" && item.videoUrl ? (
          <video src={item.videoUrl} controls autoPlay playsInline aria-label={item.alt} className="max-h-full max-w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fullUrl} alt={item.alt} className="max-h-full max-w-full object-contain" />
        )}

        {hasPrev && (
          <button
            type="button"
            onClick={goPrev}
            aria-label="前へ"
            className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-[20px]"
          >
            ‹
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={goNext}
            aria-label="次へ"
            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-[20px]"
          >
            ›
          </button>
        )}
      </div>

      {href && (
        <div className="flex justify-center px-4 py-3" onClick={(event) => event.stopPropagation()}>
          <Link href={href} className="h-10 rounded-full bg-white px-4 text-[13px] font-semibold leading-10 text-black">
            {postHrefLabel}
          </Link>
        </div>
      )}
    </div>
  );
}
