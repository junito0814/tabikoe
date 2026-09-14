import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SpotPhotoGalleryScreen } from "./SpotPhotoGalleryScreen";
import type { SpotMediaItem } from "@/lib/posts/spot-photos";

/**
 * 出典: docs/tasks/map-search/spot-photo-gallery/02-gallery-screen-ui.md
 * - 動画には再生アイコンが重畳される（shared-ui/media-layout の再利用）
 * - 追加読み込みで次の40点を取得する
 * 出典: docs/tasks/shared-ui/media-viewer/03-gallery-integration.md
 * - サムネイルのタップでモーダルが開き、←→ で読み込み済みの全点を移動できる
 * - モーダル内に元投稿の詳細（/posts/[id]）への導線がある（4.5.5、旧 spot-photo-gallery Task4 の置き換え）
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
  it("サムネイルはボタンで、動画には再生アイコンが重なる", () => {
    render(
      <SpotPhotoGalleryScreen
        spot={spot}
        initialPage={{ items: [item("a", "post-1"), item("b", "post-2", "video")], nextOffset: null }}
        fetchMedia={vi.fn()}
      />
    );
    const video = screen.getByRole("button", { name: "東京駅の動画 b" });
    expect(video.querySelector("[data-video-overlay]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "東京駅の写真 a" }).querySelector("[data-video-overlay]")).toBeNull();
  });

  it("タップでその位置からモーダルが開き、→ で次の投稿の写真へ移動でき、元投稿への導線が変わる", () => {
    render(
      <SpotPhotoGalleryScreen
        spot={spot}
        initialPage={{ items: [item("a", "post-1"), item("b", "post-2", "video")], nextOffset: null }}
        fetchMedia={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "東京駅の写真 a" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("1 / 2");
    expect(screen.getByRole("link", { name: "この投稿を見る" })).toHaveAttribute("href", "/posts/post-1");

    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(dialog).toHaveTextContent("2 / 2");
    expect(screen.getByRole("link", { name: "この投稿を見る" })).toHaveAttribute("href", "/posts/post-2");

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("「もっと見る」で nextOffset から追加読み込みする", async () => {
    const fetchMedia = vi.fn(async () => ({ items: [item("c", "post-3")], nextOffset: null }));
    render(
      <SpotPhotoGalleryScreen spot={spot} initialPage={{ items: [item("a", "post-1")], nextOffset: 40 }} fetchMedia={fetchMedia} />
    );
    fireEvent.click(screen.getByRole("button", { name: "もっと見る" }));
    await waitFor(() => expect(fetchMedia).toHaveBeenCalledWith("spot-1", 40));
    expect(await screen.findByRole("button", { name: "東京駅の写真 c" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "もっと見る" })).toBeNull();
  });

  it("写真が無ければ空メッセージ", () => {
    render(<SpotPhotoGalleryScreen spot={spot} initialPage={{ items: [], nextOffset: null }} fetchMedia={vi.fn()} />);
    expect(screen.getByText("まだ写真・動画がありません")).toBeInTheDocument();
  });
});
