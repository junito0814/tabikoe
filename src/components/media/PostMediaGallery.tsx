"use client";

import { useState } from "react";
import { MediaGrid, type MediaItem } from "./MediaGrid";
import { MediaViewerModal } from "./MediaViewerModal";

/**
 * 写真・動画ビューア Task2: 投稿詳細（SC-05）のメディア枠
 * 出典: docs/tasks/shared-ui/media-viewer/02-post-detail-integration.md
 *
 * MediaGrid の枠をタップすると、その位置から MediaViewerModal を開く。
 * PostDetailScreen は Server Component のため、状態を持つ部分をここに切り出す。
 */
export function PostMediaGallery({ items }: { items: MediaItem[] }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  return (
    <>
      <MediaGrid items={items} onSelect={setViewerIndex} />
      {viewerIndex !== null && (
        <MediaViewerModal
          items={items}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  );
}
