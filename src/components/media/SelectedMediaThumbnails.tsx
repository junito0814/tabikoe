"use client";

import { useEffect, useMemo } from "react";

export interface SelectedMedia {
  key: string;
  /** 表示用 URL（保存済みは署名付き URL、選んだばかりのファイルは object URL） */
  url: string;
  mediaType: "photo" | "video";
  alt: string;
}

/**
 * media-layout-v3 Task2: 投稿フォームのサムネイル（選んだ写真・動画をその場に並べ、× で外す）
 * 出典: docs/tasks/shared-ui/media-layout-v3/02-form-thumbnails.md
 *       要件定義書 v3.0 3.3.1（写真・動画は選んだその場にサムネイル）
 *
 * 【初心者向け】`<input type="file">` で選んだ File はまだサーバーに無いので、
 * `URL.createObjectURL(file)` でブラウザ内だけの一時 URL を作って <img> に渡す。
 * 一時 URL はメモリを使うので、不要になったら `revokeObjectURL` で解放する（useEffect の cleanup）。
 * 保存済みの写真（編集時）は署名付き URL をそのまま渡す。
 */
export function SelectedMediaThumbnails({
  items,
  onRemove,
  onAdd,
  addLabel = "追加",
}: {
  items: SelectedMedia[];
  onRemove: (key: string) => void;
  /** 「＋」を押したときの処理（file input を開く）。無ければ「＋」を出さない */
  onAdd?: () => void;
  addLabel?: string;
}) {
  if (items.length === 0 && !onAdd) return null;
  return (
    <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="選択中の写真・動画">
      {items.map((item) => (
        <li key={item.key} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[8px] bg-line" data-selected-media={item.key}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt={item.alt} className="h-full w-full object-cover" />
          {item.mediaType === "video" && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center" data-video-overlay>
              <svg width="28" height="28" viewBox="0 0 40 40" aria-hidden>
                <circle cx="20" cy="20" r="18" fill="rgba(0,0,0,0.45)" />
                <path d="M16 13l12 7-12 7z" fill="#fff" />
              </svg>
            </span>
          )}
          <button
            type="button"
            onClick={() => onRemove(item.key)}
            aria-label={`${item.alt}を外す`}
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-[13px] leading-none text-white"
          >
            ×
          </button>
        </li>
      ))}
      {onAdd && (
        <li className="shrink-0">
          <button
            type="button"
            onClick={onAdd}
            aria-label={addLabel}
            className="flex h-20 w-20 items-center justify-center rounded-[8px] border border-dashed border-line text-[22px] text-muted"
          >
            ＋
          </button>
        </li>
      )}
    </ul>
  );
}

/** File の配列から一時 URL 付きの表示項目を作る。アンマウント時に URL を解放する */
export function useObjectUrls(files: File[]): { file: File; url: string }[] {
  const entries = useMemo(
    () => files.map((file) => ({ file, url: typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : "" })),
    [files]
  );
  useEffect(() => {
    return () => {
      entries.forEach((entry) => {
        if (entry.url && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(entry.url);
      });
    };
  }, [entries]);
  return entries;
}
