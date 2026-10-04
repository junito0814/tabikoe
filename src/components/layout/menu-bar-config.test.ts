import { describe, expect, it } from "vitest";
import { MENU_ITEMS, isMenuItemActive, shouldShowMenuBar } from "./menu-bar-config";

/**
 * 出典: docs/tasks/shared-ui/menu-bar/01-menu-bar-component.md 単体テスト
 * - 4項目それぞれのリンク先が仕様通りであること（要件定義書4.2）
 * - トップページ・ログイン画面・管理画面のパスでは非表示になる判定ロジック
 */
describe("MENU_ITEMS", () => {
  it("4.2の4項目を、この順で持つ", () => {
    expect(MENU_ITEMS.map((item) => item.label)).toEqual([
      "ホーム",
      "計画",
      "通知",
      "マイページ",
    ]);
  });

  it("リンク先が各画面のパスになっている", () => {
    const byKey = Object.fromEntries(MENU_ITEMS.map((item) => [item.key, item.href]));
    expect(byKey).toEqual({
      home: "/",
      itineraries: "/itineraries",
      notifications: "/notifications",
      mypage: "/mypage",
    });
  });

  it("管理画面への項目は含まない（Task3、3.10.1）", () => {
    expect(MENU_ITEMS.some((item) => item.href.startsWith("/admin"))).toBe(false);
  });
});

describe("shouldShowMenuBar", () => {
  it.each(["/login", "/signup"])("除外画面 %s では非表示", (path) => {
    expect(shouldShowMenuBar(path)).toBe(false);
  });

  it("ホーム（/）はログイン済みなら表示、未ログインなら非表示（v3.0）", () => {
    expect(shouldShowMenuBar("/", true)).toBe(true);
    expect(shouldShowMenuBar("/", false)).toBe(false);
  });

  it.each(["/admin", "/admin/", "/admin/announcements", "/admin/reports/1"])(
    "管理画面 %s では非表示",
    (path) => {
      expect(shouldShowMenuBar(path)).toBe(false);
    }
  );

  // #583: 規約ページは未ログインでも開ける「読むだけ」のページ。メニューバーを出すと未読件数 API を呼び、
  // 再同意待ち・登録待ちの人が 401 でログイン画面へ飛ばされて規約を読めなくなる
  it.each(["/terms", "/privacy"])("規約ページ %s では非表示（#583）", (path) => {
    expect(shouldShowMenuBar(path)).toBe(false);
  });

  it("再同意画面では非表示", () => {
    expect(shouldShowMenuBar("/consent/renew")).toBe(false);
  });

  it("開発用プレビューでは非表示", () => {
    expect(shouldShowMenuBar("/dev/preview")).toBe(false);
  });

  it.each(["/map", "/posts/new", "/posts/abc/edit", "/notifications", "/mypage", "/account", "/users/xyz", "/itineraries", "/search"])(
    "通常画面 %s では表示",
    (path) => {
      expect(shouldShowMenuBar(path)).toBe(true);
    }
  );

  it("前方一致の誤判定をしない（/administrator や /loginfo は除外対象ではない）", () => {
    expect(shouldShowMenuBar("/administrator")).toBe(true);
    expect(shouldShowMenuBar("/loginfo")).toBe(true);
  });
});

describe("isMenuItemActive", () => {
  const item = (key: (typeof MENU_ITEMS)[number]["key"]) =>
    MENU_ITEMS.find((candidate) => candidate.key === key)!;

  it("完全一致とサブパスで現在地になる", () => {
    expect(isMenuItemActive(item("mypage"), "/mypage")).toBe(true);
    expect(isMenuItemActive(item("mypage"), "/mypage/albums")).toBe(true);
    expect(isMenuItemActive(item("mypage"), "/map")).toBe(false);
  });

  it("ホームは検索トップ（/）と検索結果（/search）で現在地になる（v3.0）", () => {
    expect(isMenuItemActive(item("home"), "/")).toBe(true);
    expect(isMenuItemActive(item("home"), "/search")).toBe(true);
    expect(isMenuItemActive(item("home"), "/posts/new")).toBe(false);
    expect(isMenuItemActive(item("home"), "/account")).toBe(false);
  });
});
