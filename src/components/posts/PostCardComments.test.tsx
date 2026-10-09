import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PostCard } from "./PostCard";
import type { PostCardData } from "@/lib/posts/post-cards";

/**
 * #885（2026-10-09）: 一覧のカードから、その場でコメントのシートを開く。
 *
 * 【初心者向け】それまではカードの「コメント」を押すと**投稿詳細へ画面ごと移って**いた。
 * 一覧を見ながら読みたいのに、1 件読むたびに往復することになる（実機確認での指摘）。
 *
 * ここで見張るのは 3 つ。
 *   1. 押すと**その場でシートが開く**（画面が移らない）
 *   2. **開くまでコメントを取りに行かない**（カードが 20 枚並ぶので、先に全部読むと 20 回になる）
 *   3. 閉じたときに**カードの件数とプレビューが新しくなる**（閉じてから古いままだと辻褄が合わない）
 */
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/search" }));

const fetchPage = vi.fn();
const submit = vi.fn();
vi.mock("@/lib/api/fetch-with-auth-redirect", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/fetch-with-auth-redirect")>("@/lib/api/fetch-with-auth-redirect");
  return { ...actual, fetchWithAuthRedirect: vi.fn(async () => Response.json({})) };
});

const post: PostCardData = {
  id: "p1",
  spotId: "s1",
  spotName: "浅草寺",
  category: "観光スポット",
  rating: 4,
  cost: null,
  duration: null,
  visitDate: "2026-09-20",
  commentExcerpt: "朝イチで行ったら人が少なかった",
  createdAt: "2026-09-20T01:00:00Z",
  author: { id: "u1", displayName: "たろう", avatarUrl: "/default-avatar.svg" },
  thumbnailUrl: null,
  thumbnailMediaType: null,
  mediaCount: 0,
  media: [],
  likeCount: 3,
  commentCount: 2,
  latestComment: { authorName: "みさき", excerpt: "昼前が空いてるよ" },
  viewerHasLiked: false,
  viewerHasSaved: false,
  isManualSpot: false,
  prefecture: "東京都",
  spotLat: 35.7,
  spotLng: 139.8,
  walkMinutes: null,
  latestStatus: null,
};

function commentPage(count: number, newestBody: string) {
  return {
    comments: [
      {
        id: "c1",
        body: newestBody,
        createdAt: "2026-10-09T10:00:00Z",
        author: { id: "u2", displayName: "みさき", avatarUrl: "/default-avatar.svg", isDeleted: false },
        isMine: false,
        parentId: null,
        replyToName: null,
        deleted: false,
        replies: [],
      },
    ],
    nextOffset: null,
    totalCount: count,
    viewerAvatarUrl: "/default-avatar.svg",
  };
}

beforeEach(() => {
  fetchPage.mockReset();
  submit.mockReset();
});

describe("投稿カードからコメントのシートを開く（#885）", () => {
  it("押すまでコメントを取りに行かない", () => {
    render(<PostCard post={post} commentApi={{ fetchPage, submit, remove: vi.fn() }} />);
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("コメントの件数を押すと、その場でシートが開いて 1 ページ目を取りに行く", async () => {
    fetchPage.mockResolvedValue(commentPage(2, "昼前が空いてるよ"));
    render(<PostCard post={post} commentApi={{ fetchPage, submit, remove: vi.fn() }} />);

    fireEvent.click(screen.getByRole("button", { name: "コメント 2 件" }));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledWith("p1", 0));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("「コメント N 件をすべて見る」からも同じシートが開く", async () => {
    fetchPage.mockResolvedValue(commentPage(2, "昼前が空いてるよ"));
    render(<PostCard post={post} commentApi={{ fetchPage, submit, remove: vi.fn() }} />);

    fireEvent.click(document.querySelector("[data-comment-preview]") as HTMLElement);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  });

  it("閉じると、カードの件数と最新のコメントが新しくなる", async () => {
    fetchPage.mockResolvedValue(commentPage(5, "あとで行ってみます"));
    render(<PostCard post={post} commentApi={{ fetchPage, submit, remove: vi.fn() }} />);
    expect(screen.getByRole("button", { name: "コメント 2 件" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "コメント 2 件" }));
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole("button", { name: "閉じる" })[0]);

    await waitFor(() => expect(screen.getByRole("button", { name: "コメント 5 件" })).toBeInTheDocument());
    expect(document.querySelector("[data-comment-preview]")).toHaveTextContent("あとで行ってみます");
  });
});
