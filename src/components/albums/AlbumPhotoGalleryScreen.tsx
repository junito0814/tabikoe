"use client";

import { useCallback } from "react";
import { fetchWithAuthRedirect } from "@/lib/api/fetch-with-auth-redirect";
import type { SpotMediaPage } from "@/lib/posts/spot-photos";
import { MediaGalleryScreen } from "@/components/media/MediaGalleryScreen";

export type FetchAlbumMedia = (tripId: string, offset: number) => Promise<SpotMediaPage>;

/**
 * アルバム写真一覧 Task2: アルバム写真一覧画面（SC-21）
 * 出典: docs/tasks/records/album-photos/02-album-photos-screen.md
 *
 * 画面本体はスポット写真一覧（SC-13）と共通の MediaGalleryScreen。
 * ここではアルバム名・「アルバムへ戻る」・取得元（GET /api/trips/[id]/photos）を決める。
 */
export function AlbumPhotoGalleryScreen({
  album,
  initialPage,
  fetchMedia = defaultFetchMedia,
}: {
  album: { id: string; title: string };
  initialPage: SpotMediaPage;
  /** 差し替え口（単体テスト用） */
  fetchMedia?: FetchAlbumMedia;
}) {
  const fetchPage = useCallback((offset: number) => fetchMedia(album.id, offset), [fetchMedia, album.id]);
  return (
    <MediaGalleryScreen
      title={album.title}
      backLink={{ href: `/albums/${album.id}`, label: "アルバムへ戻る" }}
      initialPage={initialPage}
      fetchPage={fetchPage}
    />
  );
}

async function defaultFetchMedia(tripId: string, offset: number): Promise<SpotMediaPage> {
  const response = await fetchWithAuthRedirect(`/api/trips/${tripId}/photos?offset=${offset}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch album media: ${response.status}`);
  }
  return (await response.json()) as SpotMediaPage;
}
