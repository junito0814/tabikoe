import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
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
  spot: { id: "s1", name: "東京駅 グランスタ", prefecture: "東京都", lat: 35.68, lng: 139.76, isManualSpot: true },
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
  hiddenReason: null,
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
    expect(screen.getByText("2026/9/1")).toBeInTheDocument();
    expect(screen.getByText("1時間以内")).toBeInTheDocument();
    expect(screen.getByText("¥1,200/人")).toBeInTheDocument();
    expect(screen.getByLabelText("星4")).toBeInTheDocument();
    expect(screen.getByAltText("東京駅 グランスタの写真 1")).toBeInTheDocument();
    expect(screen.getByAltText("東京駅 グランスタの動画 2")).toBeInTheDocument();
    expect(screen.getByText("駅弁がとても美味しかった")).toBeInTheDocument();
    expect(screen.getByText("たろう")).toBeInTheDocument();
    // #771: 秒は出さない。24 時間以上前なので日付だけ（日本時間で 2026/9/2）
    expect(screen.getByText("2026/9/2 投稿")).toBeInTheDocument();
    // 組み込み: 保存（＋）・いいね・コメント欄
    expect(screen.getByRole("button", { name: "保存する" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "いいねする" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /コメント/ })).toBeInTheDocument();
  });

  it("v3.0/v3.1: 見出しはスポット名でスポット別一覧へのリンク。上 1/3 の地図・自分も投稿する", () => {
    render(<PostDetailScreen post={post} initialComments={noComments} />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("東京駅 グランスタ");
    // #680（2026-10-05）: ラベルは廃止（決定事項 70）
    expect(heading).not.toHaveTextContent("タビコエだけの場所");
    // Bug #471: スポット別一覧から「← 投稿」でこの投稿に戻れるよう back を付ける
    expect(heading.querySelector("a")).toHaveAttribute("href", "/spots/s1?back=%2Fposts%2Fp1");
    // v3.1: 「地図で見る」ボタンは無く上 1/3 に地図（StaticSpotMap）。map-sheet Task1: 全画面への入口は右下のボタンだけ
    expect(document.querySelector("[data-static-spot-map]")).toBeInTheDocument();
    const mapHref = new URL(screen.getByRole("link", { name: "地図を全画面に" }).getAttribute("href") ?? "", "https://example.com");
    expect(mapHref.pathname).toBe("/map");
    expect(mapHref.searchParams.get("spot")).toBe("s1");
    expect(screen.queryByRole("link", { name: "🗺 地図で見る" })).toBeNull();
    expect(screen.getByRole("link", { name: /自分も投稿する/ })).toHaveAttribute("href", "/posts/new?spot=s1");
  });

  it("Bug #469・#471: back があれば戻るはその画面名でそこへ。無ければスポット名でスポット別一覧へ。地図・見出しのスポット名にはこの画面を back で渡す", () => {
    const { unmount } = render(<PostDetailScreen post={post} initialComments={noComments} back={{ href: "/mypage", label: "マイページ" }} />);
    expect(screen.getByRole("link", { name: "マイページ" })).toHaveAttribute("href", "/mypage");
    const mapHref = new URL(screen.getByRole("link", { name: "地図を全画面に" }).getAttribute("href") ?? "", "https://example.com");
    expect(mapHref.searchParams.get("back")).toBe("/posts/p1?back=%2Fmypage");
    expect(screen.getByRole("link", { name: /^東京駅 グランスタ$/ })).toHaveAttribute("href", "/spots/s1?back=%2Fposts%2Fp1%3Fback%3D%252Fmypage");
    unmount();
    render(<PostDetailScreen post={post} initialComments={noComments} />);
    expect(screen.getByRole("link", { name: "投稿一覧" })).toHaveAttribute("href", "/spots/s1");
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
    expect(screen.queryByRole("link", { name: "通報する" })).toBeNull();
    // 本人は「⋯」の中に編集・削除
    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    expect(screen.getByRole("menuitem", { name: "編集" })).toHaveAttribute("href", "/posts/p1/edit");
    expect(screen.getByRole("button", { name: "この投稿を削除" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /自分も投稿する/ })).toBeNull();
  });

  it("非公開投稿ではいいねボタンとコメントフォームを出さない", () => {
    render(<PostDetailScreen post={{ ...post, visibility: "private", canInteract: false, isOwner: true }} initialComments={noComments} />);
    expect(screen.queryByRole("button", { name: "いいねする" })).toBeNull();
    expect(screen.getByText("非公開")).toBeInTheDocument();
    expect(screen.getByText("非公開の投稿にはコメントできません")).toBeInTheDocument();
  });

  it("performance Task2: コメントが Promise で渡されたら、届くまで骨組み、届いたらコメント欄", async () => {
    let resolve!: (page: typeof noComments) => void;
    const promise = new Promise<typeof noComments>((r) => (resolve = r));
    await act(async () => {
      render(<PostDetailScreen post={post} initialComments={promise} />);
    });
    expect(screen.getByRole("status", { name: "コメントを読み込んでいます" })).toBeInTheDocument();
    await act(async () => {
      resolve(noComments);
      await promise;
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.queryByRole("status", { name: "コメントを読み込んでいます" })).toBeNull();
    expect(screen.getByRole("heading", { name: /コメント/ })).toBeInTheDocument();
  });

  it("strike-system Task 3: 自動で非公開になった投稿は本人に「確認中」と出る", () => {
    render(<PostDetailScreen post={{ ...post, isOwner: true, hiddenReason: "auto" }} initialComments={noComments} />);
    expect(screen.getByRole("note")).toHaveTextContent("運営が確認するまで他の人には表示されません");
  });
});
