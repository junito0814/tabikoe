import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MenuBarSpace } from "./MenuBarSpace";

/**
 * 出典: Issue #1024「ログイン後、読み込みが終わって本体が出るときに右下から斜めに出てくる」
 *
 * 【初心者向け】ここで確かめたいのは 1 つだけです ──
 * **メニューバーが出る画面では場所を取り、出ない画面では取らない**。
 * 余白そのもの（60px）は `layout.tsx` の CSS の仕事なので、ここでは
 * 「`data-menu-bar` を名乗る印があるかどうか」だけを見ます。
 */
let pathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

function markerCount(container: HTMLElement) {
  return container.querySelectorAll("[data-menu-bar]").length;
}

describe("MenuBarSpace（#1024）", () => {
  it.each(["/", "/search", "/itineraries", "/mypage", "/map", "/notifications", "/posts/abc", "/spots/abc"])(
    "メニューバーが出る画面（%s）では場所を取る",
    (path) => {
      pathname = path;
      const { container } = render(<MenuBarSpace />);
      expect(markerCount(container)).toBe(1);
    }
  );

  it.each(["/login", "/signup", "/consent/renew", "/terms", "/privacy", "/admin", "/admin/reports", "/dev/pins"])(
    "メニューバーが出ない画面（%s）では場所を取らない",
    (path) => {
      pathname = path;
      const { container } = render(<MenuBarSpace />);
      expect(markerCount(container)).toBe(0);
    }
  );

  it("印そのものは見た目を持たない（hidden）", () => {
    pathname = "/mypage";
    const { container } = render(<MenuBarSpace />);
    expect(container.querySelector("[data-menu-bar]")).toHaveProperty("hidden", true);
  });
});
