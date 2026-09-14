import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AlbumPhotoGalleryScreen } from "./AlbumPhotoGalleryScreen";
import type { SpotMediaItem } from "@/lib/posts/spot-photos";

/**
 * 出典: docs/tasks/records/album-photos/02-album-photos-screen.md 単体テスト
 * - アルバム名と「アルバムへ戻る」が表示され、「もっと見る」で fetchMedia(tripId, offset) が呼ばれる
 * - タップでモーダルが開き、「この投稿を見る」が元投稿を指す（MediaGalleryScreen 共通の挙動）
 */
const item = (id: string, postId: string, mediaType: "photo" | "video" = "photo"): SpotMediaItem => ({
  id,
  postId,
  mediaType,
  thumbnailUrl: `https://example.com/${id}.jpg`,
  videoUrl: null,
  alt: `京都旅行の${mediaType === "video" ? "動画" : "写真"} ${id}`,
  postedAt: "2026-09-01T00:00:00Z",
});

const album = { id: "trip-1", title: "京都旅行" };

describe("AlbumPhotoGalleryScreen（SC-21）", () => {
  it("アルバム名と「アルバムへ戻る」を表示する", () => {
    render(<AlbumPhotoGalleryScreen album={album} initialPage={{ items: [item("a", "p1")], nextOffset: null }} fetchMedia={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "京都旅行" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "アルバムへ戻る" })).toHaveAttribute("href", "/albums/trip-1");
  });

  it("「もっと見る」で fetchMedia(tripId, nextOffset) を呼ぶ", async () => {
    const fetchMedia = vi.fn(async () => ({ items: [item("b", "p2")], nextOffset: null }));
    render(<AlbumPhotoGalleryScreen album={album} initialPage={{ items: [item("a", "p1")], nextOffset: 40 }} fetchMedia={fetchMedia} />);
    fireEvent.click(screen.getByRole("button", { name: "もっと見る" }));
    await waitFor(() => expect(fetchMedia).toHaveBeenCalledWith("trip-1", 40));
    expect(await screen.findByRole("button", { name: "京都旅行の写真 b" })).toBeInTheDocument();
  });

  it("タップでモーダルが開き、「この投稿を見る」が元の投稿を指す", () => {
    render(
      <AlbumPhotoGalleryScreen
        album={album}
        initialPage={{ items: [item("a", "p1"), item("b", "p2", "video")], nextOffset: null }}
        fetchMedia={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "京都旅行の動画 b" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("2 / 2");
    expect(screen.getByRole("link", { name: "この投稿を見る" })).toHaveAttribute("href", "/posts/p2");
  });

  it("写真が無ければ空メッセージ", () => {
    render(<AlbumPhotoGalleryScreen album={album} initialPage={{ items: [], nextOffset: null }} fetchMedia={vi.fn()} />);
    expect(screen.getByText("まだ写真・動画がありません")).toBeInTheDocument();
  });
});
