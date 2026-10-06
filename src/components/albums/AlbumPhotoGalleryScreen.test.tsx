import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AlbumPhotoGalleryScreen, fetchAlbumMediaPage } from "./AlbumPhotoGalleryScreen";
import type { SpotMediaItem } from "@/lib/posts/search-photos";

/**
 * 出典: docs/tasks/records/album-photos/02-album-photos-screen.md 単体テスト
 * - アルバムへ戻るリンクと写真グリッドが出て、タップでモーダル（「この投稿を見る →」）が開く
 * - 追加読み込みは /api/trips/[id]/photos?offset= を呼ぶ
 */
const item = (id: string, postId: string): SpotMediaItem => ({
  id,
  postId,
  mediaType: "photo",
  thumbnailUrl: `https://example.com/${id}.jpg`,
  videoUrl: null,
  alt: `浅草寺の写真 ${id}`,
  postedAt: "2026-09-01T00:00:00Z",
  info: { spotName: "浅草寺", isManualSpot: false, rating: 5, duration: "1h", cost: null, authorName: "たろう", visitDate: null },
});

describe("AlbumPhotoGalleryScreen（SC-21）", () => {
  it("アルバムへ戻るリンクとグリッドが出て、タップでモーダルから投稿へ飛べる", () => {
    render(<AlbumPhotoGalleryScreen tripId="trip-1" title="夏の東北旅行" initialPage={{ items: [item("a", "post-1")], nextOffset: null }} />);
    // #813: 戻るは共通部品（BackLink）になり、文字の「←」ではなく記号になった
    expect(screen.getByRole("link", { name: "夏の東北旅行" })).toHaveAttribute("href", "/albums/trip-1");
    fireEvent.click(screen.getByRole("button", { name: "浅草寺の写真 a" }));
    // Bug #471: 投稿詳細から「← 写真」で戻れるよう back を付ける
    expect(screen.getByRole("link", { name: "この投稿を見る →" })).toHaveAttribute("href", "/posts/post-1?back=%2Falbums%2Ftrip-1%2Fphotos");
  });

  it("追加読み込みは /api/trips/[id]/photos?offset= を呼ぶ", async () => {
    const fetchMock = vi.fn<(input: string) => Promise<Response>>(async () => Response.json({ items: [item("b", "post-2")], nextOffset: null }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      render(<AlbumPhotoGalleryScreen tripId="trip-1" title="夏の東北旅行" initialPage={{ items: [item("a", "post-1")], nextOffset: 40 }} />);
      fireEvent.click(screen.getByRole("button", { name: "もっと見る" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "浅草寺の写真 b" })).toBeInTheDocument());
      expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/trips/trip-1/photos?offset=40");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("fetchAlbumMediaPage は 404 のとき例外にする", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    try {
      await expect(fetchAlbumMediaPage("trip-1", new URLSearchParams("offset=0"))).rejects.toThrow("404");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
