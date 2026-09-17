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

  it("遷移メニューは 4 導線（行きたい／アルバム／マイマップ／バッジ）でしおりが無い", () => {
    render(<MyPageScreen {...base} initialPosts={{ posts: [], nextOffset: null }} fetchPosts={vi.fn()} />);
    expect(MY_PAGE_MENU.map((item) => item.href)).toEqual(["/wishlist", "/albums", "/mymap", "/badges"]);
    expect((MY_PAGE_MENU as readonly { href: string }[]).some((item) => item.href === "/itineraries")).toBe(false);
    for (const item of MY_PAGE_MENU) {
      expect(screen.getByRole("link", { name: new RegExp(`^${item.label}`) })).toHaveAttribute("href", item.href);
    }
  });

  it("v3.0: 下書きがあるときだけ先頭に「下書き N 件」と最新 3 件、「続きを書く」は /posts/new?draft=", () => {
    const draft = (id: string) => ({ id, spotName: `場所${id}`, lat: null, lng: null, updatedAt: "2026-09-16T05:02:00Z", thumbnailUrl: null });
    const { unmount } = render(
      <MyPageScreen {...base} initialPosts={{ posts: [], nextOffset: null }} fetchPosts={vi.fn()} drafts={{ drafts: [draft("d1"), draft("d2"), draft("d3"), draft("d4")], total: 4 }} />
    );
    const section = screen.getByRole("region", { name: "下書き" });
    expect(section).toHaveTextContent("下書き 4 件");
    expect(section.querySelectorAll("[data-draft]")).toHaveLength(3);
    expect(screen.getAllByRole("link", { name: "続きを書く" })[0]).toHaveAttribute("href", "/posts/new?draft=d1");
    unmount();
    render(<MyPageScreen {...base} initialPosts={{ posts: [], nextOffset: null }} fetchPosts={vi.fn()} drafts={{ drafts: [], total: 0 }} />);
    expect(screen.queryByRole("region", { name: "下書き" })).toBeNull();
  });

  it("v3.0: 仮タイトルの投稿にだけ「タイトルを付ける」の促しが出る", () => {
    render(<MyPageScreen {...base} initialPosts={{ posts: [post("a", "今日の投稿（9/16）"), post("b", "冬旅")], nextOffset: null }} fetchPosts={vi.fn()} />);
    expect(document.querySelector("[data-rename-prompt='a']")).toBeInTheDocument();
    expect(document.querySelector("[data-rename-prompt='b']")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /この旅行にタイトルを付ける/ }));
    expect(screen.getByRole("dialog", { name: "旅行にタイトルを付ける" })).toBeInTheDocument();
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
