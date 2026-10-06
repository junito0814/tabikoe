import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PostHistoryScreen } from "./PostHistoryScreen";
import type { MyPost } from "@/lib/users/my-page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace }),
}));

/**
 * 出典: #682（投稿履歴に一覧タブを作り、マイページから投稿と下書きを移す）単体テスト
 * 要件定義書 3.6.5・ワイヤーフレーム決定事項 72
 *
 * 【初心者向け】部品（MyPostsList・DraftsSection）は動かしていないので、
 * ここで見るのは**置き場所と切り替え**。中身の細かい動きは元のテストのまま。
 */
const post = (id: string, tripTitle: string): MyPost => ({
  id,
  spotId: "s",
  spotName: "東京駅",
  category: "グルメ",
  visitDate: null,
  cost: null,
  duration: null,
  rating: null,
  commentExcerpt: null,
  createdAt: "2026-09-16T05:02:00Z",
  likeCount: 1,
  commentCount: 0,
  viewerHasLiked: false,
  isManualSpot: false,
  prefecture: null,
  spotLat: null,
  spotLng: null,
  walkMinutes: null,
  latestStatus: null,
  media: [],
  viewerHasSaved: false,
  visibility: "private",
  tripId: "t1",
  latestComment: null,
  tripTitle,
  author: { id: "me", displayName: "たろう", avatarUrl: "https://example.com/me.jpg" },
  thumbnailUrl: null,
  thumbnailMediaType: null,
  mediaCount: 0,
});

const draft = (id: string) => ({ id, spotName: `場所${id}`, lat: null, lng: null, updatedAt: "2026-09-16T05:02:00Z", thumbnailUrl: null });

const base = {
  initialPosts: { posts: [], nextOffset: null },
  tripOptions: [{ id: "t1", title: "夏旅" }],
  drafts: null,
  initialMapMode: "both" as const,
};

describe("PostHistoryScreen（SC-12 投稿履歴）", () => {
  it("画面名は「投稿履歴」で、左上にマイページへ戻る導線がある", () => {
    render(<PostHistoryScreen {...base} view="list" />);
    expect(screen.getByRole("heading", { name: "投稿履歴" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "マイページ" })).toHaveAttribute("href", "/mypage");
  });

  it("一覧が既定で、自分の投稿と下書きが出る", () => {
    render(
      <PostHistoryScreen
        {...base}
        view="list"
        initialPosts={{ posts: [post("a", "冬旅")], nextOffset: null }}
        drafts={{ drafts: [draft("d1")], total: 1 }}
        fetchPosts={vi.fn()}
      />
    );
    expect(screen.getByRole("radio", { name: "一覧" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("region", { name: "下書き" })).toBeInTheDocument();
    expect(screen.getByText("冬旅")).toBeInTheDocument();
    expect(screen.getByText("非公開")).toBeInTheDocument();
  });

  it("地図に切り替えると URL が変わる", () => {
    render(<PostHistoryScreen {...base} view="list" />);
    fireEvent.click(screen.getByRole("radio", { name: "地図" }));
    expect(replace).toHaveBeenCalledWith("/mymap?view=map");
  });

  it("一覧に戻すと URL から view が消える", () => {
    render(<PostHistoryScreen {...base} view="map" />);
    fireEvent.click(screen.getByRole("radio", { name: "一覧" }));
    expect(replace).toHaveBeenCalledWith("/mymap");
  });

  it("旅行で絞り込むと trip_id 付きで取り直す", async () => {
    const fetchPosts = vi.fn(async () => ({ posts: [post("b", "夏旅")], nextOffset: null }));
    render(
      <PostHistoryScreen {...base} view="list" initialPosts={{ posts: [post("a", "冬旅")], nextOffset: null }} fetchPosts={fetchPosts} />
    );
    fireEvent.change(screen.getByRole("combobox", { name: "旅行で絞り込み" }), { target: { value: "t1" } });
    await waitFor(() => expect(fetchPosts).toHaveBeenCalledWith("t1", 0));
  });

  it("下書きが無ければ段を出さない", () => {
    render(<PostHistoryScreen {...base} view="list" fetchPosts={vi.fn()} />);
    expect(screen.queryByRole("region", { name: "下書き" })).toBeNull();
  });
});

/**
 * #747（2026-10-06）: 地図タブで戻るボタンが 2 つ出ていた。
 * `MyMapScreen` が「あしあと」1 枚だったころの戻る（地図の上に浮かぶピル）を持っていたため。
 */
describe("戻るは 1 つだけ（#747）", () => {
  it("地図タブでも「マイページ」へ戻る導線は 1 つ", () => {
    render(<PostHistoryScreen {...base} view="map" />);
    expect(screen.getAllByRole("link", { name: "マイページ" })).toHaveLength(1);
  });

  it("地図の上にはピンの切り替えだけが残る", () => {
    render(<PostHistoryScreen {...base} view="map" />);
    expect(screen.getByRole("radiogroup", { name: "表示するピン" })).toBeInTheDocument();
  });
});
