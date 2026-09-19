import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PhotoGrid } from "./PhotoGrid";
import type { SpotMediaItem } from "@/lib/posts/search-photos";

/**
 * 出典: docs/tasks/map-search/photo-view/02-view-toggle-ui.md 単体テスト
 * - v3.2: 写真のタップでモーダル（情報バーつき）、「この投稿を見る →」で投稿詳細
 * 出典: docs/tasks/map-search/spot-photo-gallery/02-gallery-screen-ui.md（v1 から引き継ぎ）
 * - 動画には再生アイコンが重畳される、追加読み込みで次の 40 点を取得する
 */
const item = (id: string, postId: string, mediaType: "photo" | "video" = "photo"): SpotMediaItem => ({
  id,
  postId,
  mediaType,
  thumbnailUrl: `https://example.com/${id}.jpg`,
  videoUrl: null,
  alt: `東京駅の${mediaType === "video" ? "動画" : "写真"} ${id}`,
  postedAt: "2026-09-01T00:00:00Z",
  info: { spotName: "東京駅", isManualSpot: false, rating: 4, duration: "1時間以内", cost: 1200, authorName: "たろう", visitDate: "2026-09-03" },
});
const params = new URLSearchParams({ spot: "spot-1" });

describe("PhotoGrid（写真切替）", () => {
  it("v3.2: サムネイルのタップでモーダルが開き、情報バー（スポット名・★・滞在・費用・投稿者・訪問日）と「この投稿を見る →」が出る。動画には再生アイコン", () => {
    render(<PhotoGrid params={params} initialPage={{ items: [item("a", "post-1"), item("b", "post-2", "video")], nextOffset: null }} fetchPage={vi.fn()} />);
    const video = screen.getByRole("button", { name: "東京駅の動画 b" });
    expect(video.querySelector("[data-video-overlay]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "東京駅の写真 a" }));
    const info = document.querySelector("[data-media-info]") as HTMLElement;
    expect(info).toHaveTextContent("東京駅");
    expect(info).toHaveTextContent("星4");
    expect(info).toHaveTextContent("滞在 1時間以内");
    expect(info).toHaveTextContent("¥1,200/人");
    expect(info).toHaveTextContent("たろう");
    expect(info).toHaveTextContent("訪問 2026/09/03");
    expect(screen.getByRole("link", { name: "この投稿を見る →" })).toHaveAttribute("href", "/posts/post-1");
  });

  it("「もっと見る」で同じ条件＋offset で追加読み込みする", async () => {
    const fetchPage = vi.fn<(params: URLSearchParams) => Promise<{ items: SpotMediaItem[]; nextOffset: number | null }>>(async () => ({ items: [item("c", "post-3")], nextOffset: null }));
    render(<PhotoGrid params={params} initialPage={{ items: [item("a", "post-1")], nextOffset: 40 }} fetchPage={fetchPage} />);
    fireEvent.click(screen.getByRole("button", { name: "もっと見る" }));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(fetchPage.mock.calls[0][0])).toEqual({ spot: "spot-1", offset: "40" });
    expect(await screen.findByRole("button", { name: "東京駅の写真 c" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "もっと見る" })).toBeNull();
  });

  it("写真が無ければ空メッセージ", () => {
    render(<PhotoGrid params={params} initialPage={{ items: [], nextOffset: null }} fetchPage={vi.fn()} />);
    expect(screen.getByText("まだ写真・動画がありません")).toBeInTheDocument();
  });
});
