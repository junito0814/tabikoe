import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SpotPhotoGalleryScreen } from "./SpotPhotoGalleryScreen";
import type { SpotMediaItem } from "@/lib/posts/spot-photos";

/**
 * 出典: docs/tasks/map-search/spot-photo-gallery/02-gallery-screen-ui.md
 * - 動画には再生アイコンが重畳される（shared-ui/media-layout の再利用）
 * - 追加読み込みで次の40点を取得する
 * 出典: docs/tasks/map-search/spot-photo-gallery/04-post-detail-navigation.md
 * - 写真・動画は元投稿の詳細（/posts/[id]）へのリンク
 */
const item = (id: string, postId: string, mediaType: "photo" | "video" = "photo"): SpotMediaItem => ({
  id,
  postId,
  mediaType,
  thumbnailUrl: `https://example.com/${id}.jpg`,
  videoUrl: null,
  alt: `東京駅の${mediaType === "video" ? "動画" : "写真"} ${id}`,
  postedAt: "2026-09-01T00:00:00Z",
});

const spot = { id: "spot-1", name: "東京駅" };

describe("SpotPhotoGalleryScreen（SC-13）", () => {
  it("サムネイルは元投稿の詳細へのリンクで、動画には再生アイコンが重なる", () => {
    render(
      <SpotPhotoGalleryScreen
        spot={spot}
        initialPage={{ items: [item("a", "post-1"), item("b", "post-2", "video")], nextOffset: null }}
        fetchMedia={vi.fn()}
      />
    );
    expect(screen.getByRole("link", { name: "東京駅の写真 a" })).toHaveAttribute("href", "/posts/post-1");
    const video = screen.getByRole("link", { name: "東京駅の動画 b" });
    expect(video).toHaveAttribute("href", "/posts/post-2");
    expect(video.querySelector("[data-video-overlay]")).not.toBeNull();
    expect(screen.getByRole("link", { name: "東京駅の写真 a" }).querySelector("[data-video-overlay]")).toBeNull();
  });

  it("「もっと見る」で nextOffset から追加読み込みする", async () => {
    const fetchMedia = vi.fn(async () => ({ items: [item("c", "post-3")], nextOffset: null }));
    render(
      <SpotPhotoGalleryScreen spot={spot} initialPage={{ items: [item("a", "post-1")], nextOffset: 40 }} fetchMedia={fetchMedia} />
    );
    fireEvent.click(screen.getByRole("button", { name: "もっと見る" }));
    await waitFor(() => expect(fetchMedia).toHaveBeenCalledWith("spot-1", 40));
    expect(await screen.findByRole("link", { name: "東京駅の写真 c" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "もっと見る" })).toBeNull();
  });

  it("写真が無ければ空メッセージ", () => {
    render(<SpotPhotoGalleryScreen spot={spot} initialPage={{ items: [], nextOffset: null }} fetchMedia={vi.fn()} />);
    expect(screen.getByText("まだ写真・動画がありません")).toBeInTheDocument();
  });
});
