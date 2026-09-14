"use client";

import { useState } from "react";

/**
 * 写真・動画の表示レイアウト Task1〜3: MediaGrid共通コンポーネント
 * 出典: docs/tasks/shared-ui/media-layout/01-grid-layout-component.md
 *       docs/tasks/shared-ui/media-layout/02-overflow-count-badge.md
 *       docs/tasks/shared-ui/media-layout/03-video-thumbnail-inline-playback.md
 *
 * 投稿カード一覧・投稿詳細・スポット写真一覧など複数画面で共通利用する想定（7.6 保守性準拠）。
 * 1点目を常に代表画像とし、各レイアウトで最初に配置する。
 *
 * `onSelect` を渡すと各枠のタップでその位置を通知し、呼び出し側が MediaViewerModal を開く
 * （media-viewer Task2、4.5.5）。「+N」枠は4点目として通知する。
 * `onSelect` が無い場合は従来どおり動画だけその場で再生する（開発用プレビュー向けの後方互換）。
 */
export interface MediaItem {
  id: string;
  mediaType: "photo" | "video";
  thumbnailUrl: string;
  /** 代替テキスト（要件定義書7.7：画像・動画サムネイルにalt属性を設定する） */
  alt: string;
  videoUrl?: string;
}

function MediaCell({
  item,
  className,
  overflowCount,
  onSelect,
}: {
  item: MediaItem;
  className?: string;
  overflowCount?: number;
  onSelect?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  if (!onSelect && item.mediaType === "video" && isPlaying && item.videoUrl) {
    return (
      <video
        src={item.videoUrl}
        controls
        autoPlay
        aria-label={item.alt}
        className={`h-full w-full object-cover ${className ?? ""}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (onSelect) onSelect();
        else if (item.mediaType === "video") setIsPlaying(true);
      }}
      aria-label={typeof overflowCount === "number" ? `残り${overflowCount}点を見る` : item.alt}
      className={`relative block h-full w-full overflow-hidden bg-[#E8E1D8] ${className ?? ""}`}
    >
      <MediaThumbnail item={item} />

      {typeof overflowCount === "number" && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[20px] font-semibold text-white">
          +{overflowCount}
        </span>
      )}
    </button>
  );
}

/**
 * サムネイル1点。動画なら中央に再生アイコンを重ねて写真と区別する（4.5.1）。
 * MediaGrid の各枠のほか、スポット写真一覧（SC-13、F-MP-05）のグリッドでも再利用する。
 */
export function MediaThumbnail({
  item,
  className,
}: {
  item: Pick<MediaItem, "mediaType" | "thumbnailUrl" | "alt">;
  className?: string;
}) {
  return (
    <span className={`relative block h-full w-full ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.thumbnailUrl} alt={item.alt} className="h-full w-full object-cover" />

      {item.mediaType === "video" && (
        <span className="absolute inset-0 flex items-center justify-center" data-video-overlay>
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
            <circle cx="20" cy="20" r="18" fill="rgba(0,0,0,0.45)" />
            <path d="M16 13l12 7-12 7z" fill="#fff" />
          </svg>
        </span>
      )}
    </span>
  );
}

export function MediaGrid({
  items,
  onSelect,
}: {
  items: MediaItem[];
  /** 枠のタップ時に呼ぶ。引数は items 内の位置（「+N」枠は 3） */
  onSelect?: (index: number) => void;
}) {
  const select = (index: number) => (onSelect ? () => onSelect(index) : undefined);

  if (items.length === 0) {
    return null;
  }

  if (items.length === 1) {
    return (
      <div className="aspect-square w-full">
        <MediaCell item={items[0]} onSelect={select(0)} />
      </div>
    );
  }

  if (items.length === 2) {
    return (
      <div className="grid aspect-[2/1] w-full grid-cols-2 gap-0.5">
        <MediaCell item={items[0]} onSelect={select(0)} />
        <MediaCell item={items[1]} onSelect={select(1)} />
      </div>
    );
  }

  if (items.length === 3) {
    return (
      <div className="grid aspect-square w-full grid-cols-2 grid-rows-2 gap-0.5">
        <MediaCell item={items[0]} className="row-span-2" onSelect={select(0)} />
        <MediaCell item={items[1]} onSelect={select(1)} />
        <MediaCell item={items[2]} onSelect={select(2)} />
      </div>
    );
  }

  const visible = items.slice(0, 4);
  // 5点以上の場合、4枠目に「+N」を重ねる。N = 表示済み（1〜3枚目）を除いた残数
  const overflowCount = items.length > 4 ? items.length - 3 : undefined;

  return (
    <div className="grid aspect-square w-full grid-cols-2 grid-rows-2 gap-0.5">
      {visible.map((item, index) => (
        <MediaCell
          key={item.id}
          item={item}
          overflowCount={index === 3 ? overflowCount : undefined}
          onSelect={select(index)}
        />
      ))}
    </div>
  );
}
