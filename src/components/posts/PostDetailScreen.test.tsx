import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostDetailScreen } from "./PostDetailScreen";
import type { PostDetailData } from "@/lib/posts/post-detail";

/**
 * 出典: docs/tasks/browsing/post-detail-view/02-post-detail-ui.md 単体テスト
 * - 投稿の全項目が画面に表示されることを検証する
 * - 旅行タイトルが画面のどこにも表示されないことを検証する
 */
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const TRIP_TITLE = "2026年夏の東北旅行";

const post: PostDetailData = {
  id: "p1",
  spot: { id: "s1", name: "東京駅 グランスタ", prefecture: "東京都" },
  category: "グルメ",
  visitDate: "2026-09-01",
  duration: "1時間以内",
  cost: 1200,
  rating: 4,
  comment: `駅弁がとても美味しかった。${TRIP_TITLE}とは関係ない感想`,
  visibility: "public",
  createdAt: "2026-09-02T03:04:05Z",
  author: { id: "u1", displayName: "たろう", avatarUrl: "/default-avatar.svg", isDeleted: false },
  media: [
    { id: "m1", mediaType: "photo", thumbnailUrl: "https://example.com/1.jpg", alt: "東京駅 グランスタの写真 1" },
    { id: "m2", mediaType: "video", thumbnailUrl: "https://example.com/2.jpg", alt: "東京駅 グランスタの動画 2", videoUrl: "https://example.com/2.mp4" },
  ],
  likeCount: 5,
  commentCount: 0,
  viewerHasLiked: false,
  isWishlisted: false,
  isOwner: false,
  canInteract: true,
  spotStatus: { latest: null, mine: null },
};

const noComments = { comments: [], nextOffset: null, totalCount: 0 };

describe("PostDetailScreen（SC-05）", () => {
  it("投稿の全項目（スポット名・カテゴリ・日付・滞在時間・費用・星評価・写真・動画・感想・投稿者・投稿日時）を表示する", () => {
    // 感想に旅行タイトルが含まれるケースは別テストで扱うため、ここでは含めない
    render(<PostDetailScreen post={{ ...post, comment: "駅弁がとても美味しかった" }} initialComments={noComments} />);
    expect(screen.getByText("東京駅 グランスタ")).toBeInTheDocument();
    expect(screen.getByText("グルメ")).toBeInTheDocument();
    expect(screen.getByText(new Date("2026-09-01").toLocaleDateString("ja-JP"))).toBeInTheDocument();
    expect(screen.getByText("1時間以内")).toBeInTheDocument();
    expect(screen.getByText("¥1,200")).toBeInTheDocument();
    expect(screen.getByLabelText("星4")).toBeInTheDocument();
    expect(screen.getByAltText("東京駅 グランスタの写真 1")).toBeInTheDocument();
    expect(screen.getByAltText("東京駅 グランスタの動画 2")).toBeInTheDocument();
    expect(screen.getByText("駅弁がとても美味しかった")).toBeInTheDocument();
    expect(screen.getByText("たろう")).toBeInTheDocument();
    expect(screen.getByText(new Date("2026-09-02T03:04:05Z").toLocaleString("ja-JP"))).toBeInTheDocument();
    // 組み込み: 行きたい・いいね・コメント欄
    expect(screen.getByRole("button", { name: "行きたいに保存" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "いいねする" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /コメント/ })).toBeInTheDocument();
  });

  it("旅行タイトルは画面のどこにも表示されない", () => {
    // PostDetailData に旅行タイトルの項目自体が無い（型で担保）。描画結果にも出ないことを確認する
    render(<PostDetailScreen post={{ ...post, comment: "感想のみ" }} initialComments={noComments} />);
    expect(document.body.textContent).not.toContain(TRIP_TITLE);
    expect(document.body.textContent).not.toContain("旅行タイトル");
    expect("tripTitle" in post).toBe(false);
  });

  it("本人には編集・削除、他人には通報の導線を出す", () => {
    const { unmount } = render(<PostDetailScreen post={post} initialComments={noComments} />);
    expect(screen.getByRole("link", { name: "通報する" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "編集" })).toBeNull();
    unmount();
    render(<PostDetailScreen post={{ ...post, isOwner: true }} initialComments={noComments} />);
    expect(screen.getByRole("link", { name: "編集" })).toHaveAttribute("href", "/posts/p1/edit");
    expect(screen.getByRole("button", { name: "この投稿を削除" })).toBeInTheDocument();
  });

  it("非公開投稿ではいいねボタンとコメントフォームを出さない", () => {
    render(<PostDetailScreen post={{ ...post, visibility: "private", canInteract: false, isOwner: true }} initialComments={noComments} />);
    expect(screen.queryByRole("button", { name: "いいねする" })).toBeNull();
    expect(screen.getByText("非公開")).toBeInTheDocument();
    expect(screen.getByText("非公開の投稿にはコメントできません")).toBeInTheDocument();
  });
});
