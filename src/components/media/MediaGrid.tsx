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
 */
export interface MediaItem {
  id: string;
  mediaType: "photo" | "video";
  thumbnailUrl: string;
  videoUrl?: string;
}

function MediaCell({
  item,
  className,
  overflowCount,
}: {
  item: MediaItem;
  className?: string;
  overflowCount?: number;
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  if (item.mediaType === "video" && isPlaying && item.videoUrl) {
    return (
      <video
        src={item.videoUrl}
        controls
        autoPlay
        className={`h-full w-full object-cover ${className ?? ""}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => item.mediaType === "video" && setIsPlaying(true)}
      className={`relative block h-full w-full overflow-hidden bg-[#E8E1D8] ${className ?? ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />

      {item.mediaType === "video" && (
        <span className="absolute inset-0 flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
            <circle cx="20" cy="20" r="18" fill="rgba(0,0,0,0.45)" />
            <path d="M16 13l12 7-12 7z" fill="#fff" />
          </svg>
        </span>
      )}

      {typeof overflowCount === "number" && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[20px] font-semibold text-white">
          +{overflowCount}
        </span>
      )}
    </button>
  );
}

export function MediaGrid({ items }: { items: MediaItem[] }) {
  if (items.length === 0) {
    return null;
  }

  if (items.length === 1) {
    return (
      <div className="aspect-square w-full">
        <MediaCell item={items[0]} />
      </div>
    );
  }

  if (items.length === 2) {
    return (
      <div className="grid aspect-[2/1] w-full grid-cols-2 gap-0.5">
        <MediaCell item={items[0]} />
        <MediaCell item={items[1]} />
      </div>
    );
  }

  if (items.length === 3) {
    return (
      <div className="grid aspect-square w-full grid-cols-2 grid-rows-2 gap-0.5">
        <MediaCell item={items[0]} className="row-span-2" />
        <MediaCell item={items[1]} />
        <MediaCell item={items[2]} />
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
        />
      ))}
    </div>
  );
}
