import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SpotPostListScreen } from "./SpotPostListScreen";
import type { PostCardData } from "@/lib/posts/post-cards";

/**
 * 出典: docs/tasks/map-search/pin-interaction/02-post-list-ui.md 単体テスト
 * - 並び替えUIの選択に応じて、Task1へ渡すパラメータが正しく切り替わることを検証する
 * - 投稿が0件の場合「まだ投稿がありません」と表示する
 * 出典: docs/tasks/map-search/pin-interaction/03-post-detail-navigation.md
 * - 投稿カードは投稿詳細（/posts/[id]）へのリンク
 * 出典: docs/tasks/map-search/spot-photo-gallery/03-photo-tag-entry-point.md
 * - 「写真」タグは SC-13（/spots/[id]/photos）へのリンク
 */
const spot = { id: "spot-1", name: "東京駅", prefecture: "東京都", isWishlisted: false };

const card = (id: string): PostCardData => ({
  id,
  spotId: "spot-1",
  spotName: "東京駅",
  category: "グルメ",
  visitDate: "2026-09-01",
  duration: "1時間以内",
  cost: 1200,
  rating: 4,
  commentExcerpt: "良かった",
  createdAt: "2026-09-02T00:00:00Z",
  author: { id: "u1", displayName: "たろう", avatarUrl: "/default-avatar.svg" },
  thumbnailUrl: "https://example.com/p.jpg",
  thumbnailMediaType: "photo",
  mediaCount: 1,
  likeCount: 2,
  commentCount: 0,
  viewerHasLiked: false,
});

describe("SpotPostListScreen（SC-04）", () => {
  it("投稿が0件なら「まだ投稿がありません」", () => {
    render(<SpotPostListScreen spot={spot} initialPage={{ posts: [], nextOffset: null }} fetchPosts={vi.fn()} />);
    expect(screen.getByText("まだ投稿がありません")).toBeInTheDocument();
  });

  it("並び替えを選ぶと、その sort で先頭から取り直す", async () => {
    const fetchPosts = vi.fn(async () => ({ posts: [card("p2")], nextOffset: null }));
    render(
      <SpotPostListScreen spot={spot} initialPage={{ posts: [card("p1")], nextOffset: null }} fetchPosts={fetchPosts} />
    );
    expect(screen.getByRole("radio", { name: "新着順" })).toHaveAttribute("aria-checked", "true");
    expect(fetchPosts).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: "評価順" }));
    await waitFor(() => expect(fetchPosts).toHaveBeenCalledWith("spot-1", "rating", 0));
    expect(screen.getByRole("radio", { name: "評価順" })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("radio", { name: "いいね順" }));
    await waitFor(() => expect(fetchPosts).toHaveBeenLastCalledWith("spot-1", "likes", 0));

    fireEvent.click(screen.getByRole("radio", { name: "新着順" }));
    await waitFor(() => expect(fetchPosts).toHaveBeenLastCalledWith("spot-1", "newest", 0));
  });

  it("「もっと見る」で nextOffset から追加読み込みする", async () => {
    const fetchPosts = vi.fn(async () => ({ posts: [card("p21")], nextOffset: null }));
    render(
      <SpotPostListScreen spot={spot} initialPage={{ posts: [card("p1")], nextOffset: 20 }} fetchPosts={fetchPosts} />
    );
    fireEvent.click(screen.getByRole("button", { name: "もっと見る" }));
    await waitFor(() => expect(fetchPosts).toHaveBeenCalledWith("spot-1", "newest", 20));
    expect(await screen.findByText("良かった", { selector: "[data-post-card='p21'] *" })).toBeInTheDocument();
  });

  it("投稿カードは投稿詳細へ、「写真」タグはスポット写真一覧へのリンク", () => {
    render(
      <SpotPostListScreen spot={spot} initialPage={{ posts: [card("p1")], nextOffset: null }} fetchPosts={vi.fn()} />
    );
    expect(document.querySelector("[data-post-card='p1'] a[href='/posts/p1']")).not.toBeNull();
    expect(screen.getByRole("link", { name: "写真" })).toHaveAttribute("href", "/spots/spot-1/photos");
  });

  it("カードのサムネイルをタップすると、その投稿の写真・動画がモーダルで開く（media-viewer Task4）", async () => {
    const fetchPostMedia = vi.fn(async () => [
      { id: "m1", mediaType: "photo" as const, thumbnailUrl: "https://example.com/1.jpg", alt: "東京駅の写真 1" },
      { id: "m2", mediaType: "photo" as const, thumbnailUrl: "https://example.com/2.jpg", alt: "東京駅の写真 2" },
    ]);
    render(
      <SpotPostListScreen
        spot={spot}
        initialPage={{ posts: [card("p1")], nextOffset: null }}
        fetchPosts={vi.fn()}
        fetchPostMedia={fetchPostMedia}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "東京駅の写真を見る" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("1 / 2");
    expect(fetchPostMedia).toHaveBeenCalledWith("p1");
  });
});
