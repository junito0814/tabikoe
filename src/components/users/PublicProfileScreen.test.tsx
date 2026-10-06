import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PublicProfileScreen } from "./PublicProfileScreen";
import type { PostCardData } from "@/lib/posts/post-cards";
import type { PublicProfileStats } from "@/lib/users/public-profile";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

/**
 * 出典: 要件定義書 3.5.6（SC-33）／Issue #767
 */
const stats: PublicProfileStats = { postCount: 12, receivedLikeCount: 34, registeredSpotCount: 5, badgeCount: 7, badgeTotal: 63 };

const post = (id: string): PostCardData =>
  ({
    id,
    spot: { id: `s-${id}`, name: `スポット${id}`, prefecture: "大阪府", lat: 34.7, lng: 135.5, isManualSpot: false },
    category: "グルメ",
    visitDate: "2026-09-01",
    duration: "30分以内",
    cost: null,
    rating: 4,
    commentExcerpt: "よかった",
    media: [],
    author: { id: "u1", displayName: "たろう", avatarUrl: "/a.png", isDeleted: false },
    likeCount: 0,
    commentCount: 0,
    viewerHasLiked: false,
    isWishlisted: false,
    createdAt: "2026-09-02T00:00:00Z",
  }) as unknown as PostCardData;

const show = (overrides: Partial<Parameters<typeof PublicProfileScreen>[0]> = {}) =>
  render(
    <PublicProfileScreen
      userId="u1"
      displayName="たろう"
      avatarUrl="/a.png"
      stats={stats}
      posts={[post("p1"), post("p2")]}
      isSelf={false}
      back={{ href: "/posts/p9", label: "投稿" }}
      selfHref="/users/u1"
      {...overrides}
    />
  );

describe("他ユーザーのプロフィール（#767）", () => {
  it("左上に「‹ 〈来た画面〉」が出る（要件 4.5.13）", () => {
    show();
    expect(screen.getByRole("link", { name: "投稿" })).toHaveAttribute("href", "/posts/p9");
  });

  it("来た画面が分からなければホームへ戻る", () => {
    show({ back: null });
    expect(screen.getByRole("link", { name: "ホーム" })).toHaveAttribute("href", "/");
  });

  it("通報・ブロックは「⋯」の中（下線のリンクにしない）", () => {
    show();
    expect(screen.queryByRole("link", { name: "通報する" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    expect(screen.getByRole("menuitem", { name: "通報する" })).toHaveAttribute("href", expect.stringContaining("/report"));
    expect(screen.getByRole("button", { name: /ブロック/ })).toBeInTheDocument();
  });

  it("自分の画面では「⋯」を出さない（自分を通報・ブロックできない）", () => {
    show({ isSelf: true });
    expect(screen.queryByRole("button", { name: "その他" })).toBeNull();
  });

  it("投稿数・獲得いいね・登録した場所・バッジ ◯/63 が出る", () => {
    show();
    const numbers = document.querySelector("[data-profile-stats]")?.textContent ?? "";
    expect(numbers).toContain("投稿12");
    expect(numbers).toContain("獲得いいね34");
    expect(numbers).toContain("登録した場所5");
    expect(screen.getByText("バッジ 7 / 63")).toBeInTheDocument();
  });

  it("その人の投稿が並び、押すと投稿詳細へ行く", () => {
    show();
    expect(document.querySelectorAll("[data-post-card]")).toHaveLength(2);
    const links = [...document.querySelectorAll("[data-post-card='p1'] a")].map((a) => a.getAttribute("href"));
    expect(links.some((href) => href?.startsWith("/posts/p1"))).toBe(true);
  });

  it("公開投稿が無ければその旨だけ（アルバム・しおり・行きたては出さない）", () => {
    show({ posts: [] });
    expect(screen.getByText("まだ公開された投稿はありません")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("アルバム");
    expect(document.body.textContent).not.toContain("しおり");
    expect(document.body.textContent).not.toContain("行きたい");
  });
});
