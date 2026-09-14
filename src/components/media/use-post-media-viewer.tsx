"use client";

import { useCallback, useState, type ReactNode } from "react";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { MediaItem } from "./MediaGrid";
import { MediaViewerModal } from "./MediaViewerModal";

export type FetchPostMedia = (postId: string) => Promise<MediaItem[]>;

/**
 * 写真・動画ビューア Task4: 投稿カードのサムネイルから、その投稿の全メディアをモーダルで開く
 * 出典: docs/tasks/shared-ui/media-viewer/04-post-card-integration.md
 *
 * カード（SC-04/06/09・検索結果）は代表画像1点しか持っていないため、タップ時に
 * GET /api/posts/[id] から全点（署名付きURL）を取り、1点目からモーダルを開く。
 * 呼び出し側は `openPost(postId)` をサムネイルに結び、`viewer` を画面のどこかに描画する。
 */
export function usePostMediaViewer(fetchPostMedia: FetchPostMedia = defaultFetchPostMedia): {
  openPost: (postId: string) => Promise<void>;
  loadingPostId: string | null;
  errorMessage: string | null;
  viewer: ReactNode;
} {
  const [state, setState] = useState<{ items: MediaItem[]; index: number } | null>(null);
  const [loadingPostId, setLoadingPostId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const openPost = useCallback(
    async (postId: string) => {
      if (loadingPostId) return;
      setLoadingPostId(postId);
      setErrorMessage(null);
      try {
        const items = await fetchPostMedia(postId);
        if (items.length > 0) setState({ items, index: 0 });
      } catch (error) {
        if (error instanceof UnauthorizedError) return;
        setErrorMessage("写真・動画を読み込めませんでした");
      } finally {
        setLoadingPostId(null);
      }
    },
    [fetchPostMedia, loadingPostId]
  );

  const viewer = state ? (
    <MediaViewerModal
      items={state.items}
      index={state.index}
      onIndexChange={(index) => setState({ items: state.items, index })}
      onClose={() => setState(null)}
    />
  ) : null;

  return { openPost, loadingPostId, errorMessage, viewer };
}

async function defaultFetchPostMedia(postId: string): Promise<MediaItem[]> {
  const response = await fetchWithAuthRedirect(`/api/posts/${postId}`);
  if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
  const { post } = (await response.json()) as { post: { media: MediaItem[] } };
  return post.media;
}
