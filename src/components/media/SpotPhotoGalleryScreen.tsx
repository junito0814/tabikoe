"use client";

import { useCallback } from "react";
import { fetchWithAuthRedirect } from "@/lib/api/fetch-with-auth-redirect";
import type { SpotMediaPage } from "@/lib/posts/spot-photos";
import { MediaGalleryScreen } from "./MediaGalleryScreen";

export type FetchSpotMedia = (spotId: string, offset: number) => Promise<SpotMediaPage>;

/**
 * F-MP-05 Task2・Task4: スポット写真一覧画面（SC-13）
 * 出典: docs/tasks/map-search/spot-photo-gallery/02-gallery-screen-ui.md
 *       docs/tasks/map-search/spot-photo-gallery/04-post-detail-navigation.md
 *
 * 画面本体は MediaGalleryScreen（アルバム写真一覧 SC-21 と共通）。
 * ここではスポット名・「投稿一覧へ」の戻り先・取得元（GET /api/spots/[id]/photos）を決める。
 */
export function SpotPhotoGalleryScreen({
  spot,
  initialPage,
  fetchMedia = defaultFetchMedia,
}: {
  spot: { id: string; name: string };
  initialPage: SpotMediaPage;
  /** 差し替え口（単体テスト用） */
  fetchMedia?: FetchSpotMedia;
}) {
  const fetchPage = useCallback((offset: number) => fetchMedia(spot.id, offset), [fetchMedia, spot.id]);
  return (
    <MediaGalleryScreen
      title={spot.name}
      backLink={{ href: `/spots/${spot.id}`, label: "投稿一覧へ" }}
      initialPage={initialPage}
      fetchPage={fetchPage}
    />
  );
}

async function defaultFetchMedia(spotId: string, offset: number): Promise<SpotMediaPage> {
  const response = await fetchWithAuthRedirect(`/api/spots/${spotId}/photos?offset=${offset}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch spot media: ${response.status}`);
  }
  return (await response.json()) as SpotMediaPage;
}
