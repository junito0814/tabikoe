"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PhotoGrid, type FetchMediaPage } from "@/components/media/PhotoGrid";
import { fetchWithAuthRedirect } from "@/lib/api/fetch-with-auth-redirect";
import type { SpotMediaPage } from "@/lib/posts/search-photos";

/**
 * F-RC-05 Task2: SC-21 アルバム写真一覧（画面）
 * 出典: docs/tasks/records/album-photos/02-album-photos-screen.md
 *       docs/user-stories/records/album-photos.md
 *
 * 【初心者向け】中身は検索の写真タブと同じ PhotoGrid。違いは「どこから取るか」だけなので、
 * fetchPage を /api/trips/[id]/photos に向けた関数に差し替えて渡す（PhotoGrid は offset を足して呼ぶ）。
 * タップでモーダル（情報バー＋「この投稿を見る →」）、40 点ずつ無限スクロール、新着順。
 */
export function AlbumPhotoGalleryScreen({ tripId, title, initialPage }: { tripId: string; title: string; initialPage: SpotMediaPage }) {
  const fetchPage = useMemo<FetchMediaPage>(() => (params) => fetchAlbumMediaPage(tripId, params), [tripId]);
  const params = useMemo(() => new URLSearchParams(), []);

  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
      <div className="flex w-full max-w-[560px] flex-col gap-4">
        <header className="flex flex-col gap-1">
          <Link href={`/albums/${tripId}`} className="text-[12px] text-muted underline underline-offset-2">
            ← {title}
          </Link>
          <h1 className="text-[18px] font-bold text-ink">写真・動画</h1>
        </header>
        <PhotoGrid params={params} initialPage={initialPage} fetchPage={fetchPage} backHref={`/albums/${tripId}/photos`} />
      </div>
    </div>
  );
}

/** アルバム写真一覧 API（メンバー以外は 404） */
export async function fetchAlbumMediaPage(tripId: string, params: URLSearchParams): Promise<SpotMediaPage> {
  const response = await fetchWithAuthRedirect(`/api/trips/${tripId}/photos?${params.toString()}`);
  if (!response.ok) throw new Error(`Failed to fetch album photos: ${response.status}`);
  return (await response.json()) as SpotMediaPage;
}
