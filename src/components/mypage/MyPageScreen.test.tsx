import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MyPageScreen } from "./MyPageScreen";
import { MY_PAGE_MENU } from "./MyPageMenu";
import type { MyPost } from "@/lib/users/my-page";

/**
 * 出典: docs/tasks/records/my-page/01-my-page-layout.md 単体テスト
 * - プロフィールブロックが、ログインユーザーのアイコン・ユーザー名を正しく表示することを検証する
 * 出典: docs/tasks/records/my-page/04-navigation-menu-links.md 単体テスト
 * - 各メニュー項目のタップ・クリックで、想定した遷移先パスへのナビゲーションが発火することを検証する
 * 出典: docs/tasks/posts/trip-title/05-display-scope-control.md
 * - マイページの投稿一覧には旅行タイトルを表示する
 */
const post = (id: string, tripTitle: string): MyPost => ({
  id,
  spotId: "s",
  spotName: "東京駅",
  category: "グルメ",
  visitDate: null,
  duration: null,
  cost: null,
  rating: null,
  commentExcerpt: null,
  createdAt: "2026-09-01T00:00:00Z",
  author: { id: "me", displayName: "わたし", avatarUrl: "/default-avatar.svg" },
  thumbnailUrl: null,
  thumbnailMediaType: null,
  mediaCount: 0,
  likeCount: 1,
  commentCount: 0,
  viewerHasLiked: false, isManualSpot: false, prefecture: null, spotLat: null, spotLng: null, walkMinutes: null, latestStatus: null, media: [], viewerHasSaved: false,
  visibility: "private",
  tripId: "t1",
  tripTitle,
});

const base = {
  profile: { displayName: "たろう", avatarUrl: "https://example.com/me.jpg", isAdmin: false },
  summary: { postCount: 7, receivedLikeCount: 12 },
  tripOptions: [{ id: "t1", title: "夏旅" }],
};

describe("MyPageScreen（SC-06）", () => {
  it("プロフィールにアイコンとユーザー名、サマリーに投稿数と獲得いいねを表示する", () => {
    render(<MyPageScreen {...base} initialPosts={{ posts: [], nextOffset: null }} fetchPosts={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "たろう" })).toBeInTheDocument();
    expect(screen.getByAltText("たろうのアイコン画像")).toHaveAttribute("src", "https://example.com/me.jpg");
    expect(screen.getByRole("link", { name: "プロフィールを編集" })).toHaveAttribute("href", "/account");
    expect(document.querySelector("[data-summary='postCount']")).toHaveTextContent("7");
    expect(document.querySelector("[data-summary='receivedLikeCount']")).toHaveTextContent("12");
  });

  it("遷移メニューの4導線がそれぞれの画面へ向く", () => {
    render(<MyPageScreen {...base} initialPosts={{ posts: [], nextOffset: null }} fetchPosts={vi.fn()} />);
    expect(MY_PAGE_MENU.map((item) => item.href)).toEqual(["/albums", "/mymap", "/wishlist", "/badges"]);
    for (const item of MY_PAGE_MENU) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }
  });

  it("投稿一覧には旅行タイトルと非公開バッジが出て、旅行で絞り込むと trip_id 付きで取り直す", async () => {
    const fetchPosts = vi.fn(async () => ({ posts: [post("b", "夏旅")], nextOffset: null }));
    render(<MyPageScreen {...base} initialPosts={{ posts: [post("a", "冬旅")], nextOffset: null }} fetchPosts={fetchPosts} />);
    expect(screen.getByText("冬旅")).toBeInTheDocument();
    expect(screen.getByText("非公開")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "旅行で絞り込み" }), { target: { value: "t1" } });
    await waitFor(() => expect(fetchPosts).toHaveBeenCalledWith("t1", 0));
    await waitFor(() => expect(document.querySelector("[data-my-post='b'] [data-trip-title]")).toHaveTextContent("夏旅"));
  });

  it("管理者には管理者ダッシュボードへの導線を出す", () => {
    render(<MyPageScreen {...base} profile={{ ...base.profile, isAdmin: true }} initialPosts={{ posts: [], nextOffset: null }} fetchPosts={vi.fn()} />);
    expect(screen.getByRole("link", { name: "管理者ダッシュボード" })).toHaveAttribute("href", "/admin");
  });
});
