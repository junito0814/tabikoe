import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MyPageScreen } from "./MyPageScreen";
import { MY_PAGE_MENU } from "./MyPageMenu";

/*
 * loading-feedback Task 9（2026-10-02）: この画面は `PullToRefresh` で包まれ、
 * 引っ張って更新のために `useRouter().refresh()` を使うようになった。
 * 単体テストには Next.js のルーターが無いので、ここで差し替える。
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

/**
 * 出典: docs/tasks/records/my-page/01-my-page-layout.md 単体テスト
 * - プロフィールブロックが、ログインユーザーのアイコン・ユーザー名を正しく表示することを検証する
 * 出典: docs/tasks/records/my-page/04-navigation-menu-links.md 単体テスト
 * - 各メニュー項目のタップ・クリックで、想定した遷移先パスへのナビゲーションが発火することを検証する
 *
 * #682（2026-10-05）: **投稿一覧と下書きは「投稿履歴」（SC-12）へ移した。**
 * それらのテストは PostHistoryScreen.test.tsx にある。
 */
const base = {
  profile: { displayName: "たろう", avatarUrl: "https://example.com/me.jpg", isAdmin: false },
  summary: { postCount: 7, receivedLikeCount: 12 },
};

describe("MyPageScreen（SC-06）", () => {
  it("プロフィールにアイコンとユーザー名、サマリーに投稿数と獲得いいねを表示する", () => {
    render(<MyPageScreen {...base} />);
    expect(screen.getByRole("heading", { name: "たろう" })).toBeInTheDocument();
    expect(screen.getByAltText("たろうのアイコン画像")).toHaveAttribute("src", "https://example.com/me.jpg");
    expect(screen.getByRole("link", { name: "プロフィールを編集" })).toHaveAttribute("href", "/account");
    expect(document.querySelector("[data-summary='postCount']")).toHaveTextContent("7");
    expect(document.querySelector("[data-summary='receivedLikeCount']")).toHaveTextContent("12");
  });

  it("遷移メニューは 4 導線（行きたい／アルバム／投稿履歴／バッジ）でしおりが無い", () => {
    render(<MyPageScreen {...base} />);
    expect(MY_PAGE_MENU.map((item) => item.href)).toEqual(["/wishlist", "/albums", "/mymap", "/badges"]);
    expect((MY_PAGE_MENU as readonly { href: string }[]).some((item) => item.href === "/itineraries")).toBe(false);
    for (const item of MY_PAGE_MENU) {
      expect(screen.getByRole("link", { name: new RegExp(`^${item.label}`) })).toHaveAttribute("href", item.href);
    }
  });

  /** #682: マイページには投稿一覧と下書きを出さない */
  it("投稿一覧と下書きは出さない（投稿履歴へ移した）", () => {
    render(<MyPageScreen {...base} />);
    expect(screen.queryByRole("region", { name: "下書き" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "旅行で絞り込み" })).toBeNull();
  });

  it("v3.1: 旧文言（マイマップ・旅行タイトル）が出ず、遷移メニューに「投稿履歴」がある", () => {
    render(<MyPageScreen {...base} />);
    expect(document.body.textContent).not.toContain("マイマップ");
    expect(document.body.textContent).not.toContain("旅行タイトル");
    expect(screen.getByRole("link", { name: /投稿履歴/ })).toHaveAttribute("href", "/mymap");
  });

  it("管理者には管理者ダッシュボードへの導線を出す", () => {
    render(<MyPageScreen {...base} profile={{ ...base.profile, isAdmin: true }} />);
    expect(screen.getByRole("link", { name: "管理者ダッシュボード" })).toHaveAttribute("href", "/admin");
  });
});
