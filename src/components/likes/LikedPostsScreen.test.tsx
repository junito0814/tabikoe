import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LikedPostsScreen } from "./LikedPostsScreen";
import type { PostCardData, PostCardPage } from "@/lib/posts/post-cards";
import type { SpotMediaPage } from "@/lib/posts/search-photos";

/**
 * 出典: Issue #954、要件定義書 3.6.6「いいねした投稿」（SC-34）
 * - 見出し・件数・戻るが「行きたい」「アルバム」「投稿履歴」と同じ形
 * - 並び替えは「いいねが新しい順」「いいねが古い順」の 2 つだけ
 * - 1 件も無いときに、増やし方が書いてある
 */
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const post = (id: string, spotName: string): PostCardData => ({
  id,
  spotId: `spot-${id}`,
  spotName,
  category: "グルメ",
  visitDate: "2026-10-01",
  duration: "1時間以内",
  cost: 1200,
  rating: 4,
  commentExcerpt: `${spotName}はよかった`,
  createdAt: "2026-10-02T00:00:00Z",
  author: { id: "u1", displayName: "はなこ", avatarUrl: "" },
  thumbnailUrl: null,
  thumbnailMediaType: null,
  mediaCount: 0,
  media: [],
  likeCount: 3,
  commentCount: 0,
  latestComment: null,
  viewerHasLiked: true,
  viewerHasSaved: false,
  isManualSpot: false,
  prefecture: "東京都",
  spotLat: null,
  spotLng: null,
  walkMinutes: null,
  latestStatus: null,
});

const EMPTY_MEDIA: SpotMediaPage = { items: [], nextOffset: null };
const page = (posts: PostCardData[], nextOffset: number | null = null): PostCardPage => ({ posts, nextOffset });

const show = (over: Partial<Parameters<typeof LikedPostsScreen>[0]> = {}) =>
  render(
    <LikedPostsScreen
      view="posts"
      sort="newest"
      totalCount={1}
      initialPage={page([post("a", "浅草寺")])}
      initialMediaPage={EMPTY_MEDIA}
      {...over}
    />
  );

describe("LikedPostsScreen（SC-34）", () => {
  it("「‹ アカウント」・見出し・件数が、ほかの記録の画面と同じ形で出る", () => {
    show({ totalCount: 12 });
    expect(screen.getByRole("link", { name: "アカウント" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("heading", { name: "いいねした投稿" })).toBeInTheDocument();
    expect(screen.getByText("12 件")).toBeInTheDocument();
  });

  it("並び替えは「いいねが新しい順」「いいねが古い順」の 2 つだけ", () => {
    show();
    const select = screen.getByRole("combobox", { name: "並び替え" });
    expect([...select.querySelectorAll("option")].map((option) => option.textContent)).toEqual(["いいねが新しい順", "いいねが古い順"]);
  });

  it("並び替えを変えると URL に入る（戻ってきても同じ並びで開くため）", () => {
    show();
    fireEvent.change(screen.getByRole("combobox", { name: "並び替え" }), { target: { value: "oldest" } });
    expect(replace).toHaveBeenCalledWith("/likes?sort=oldest", { scroll: false });
  });

  it("「写真」に切り替えると URL に入る", () => {
    show();
    fireEvent.click(screen.getByRole("radio", { name: "写真" }));
    expect(replace).toHaveBeenCalledWith("/likes?view=photos", { scroll: false });
  });

  it("投稿カードにスポット名と投稿者名が出る（自分の投稿一覧と違い、誰の投稿かが要る）", () => {
    show();
    expect(screen.getByText("浅草寺")).toBeInTheDocument();
    expect(screen.getByText("はなこ")).toBeInTheDocument();
  });

  it("1 件も無いときは、増やし方が書いてある（要件 4.5.12）", () => {
    show({ totalCount: 0, initialPage: page([]) });
    expect(screen.getByText("まだいいねした投稿がありません")).toBeInTheDocument();
    expect(screen.getByText("気になった投稿の ♡ を押すと、ここにたまります")).toBeInTheDocument();
  });

  it("「もっと見る」で続きを読む", async () => {
    const fetchPosts = vi.fn(async () => page([post("b", "雷門")]));
    show({ initialPage: page([post("a", "浅草寺")], 20), fetchPosts });
    fireEvent.click(screen.getByRole("button", { name: "もっと見る" }));
    await waitFor(() => expect(screen.getByText("雷門")).toBeInTheDocument());
    expect(fetchPosts).toHaveBeenCalledWith("newest", 20);
  });
});
