import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AppMenuBar, UnreadBadge } from "./AppMenuBar";

/**
 * 出典: docs/tasks/shared-ui/menu-bar/01-menu-bar-component.md 単体テスト
 *       docs/tasks/shared-ui/menu-bar/02-unread-notification-badge.md 単体テスト
 *       docs/tasks/shared-ui/menu-bar/03-admin-access-control.md 単体テスト
 */
let pathname = "/account";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

beforeEach(() => {
  pathname = "/account";
});

describe("AppMenuBar 表示制御（Task1）", () => {
  it("通常画面では4項目のリンクを表示する", async () => {
    render(<AppMenuBar fetchUnreadCount={async () => 0} />);
    const nav = screen.getByRole("navigation", { name: "メインメニュー" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ホーム/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /しおり/ })).toHaveAttribute("href", "/itineraries");
    expect(screen.getByRole("link", { name: /通知/ })).toHaveAttribute("href", "/notifications");
    expect(screen.getByRole("link", { name: /マイページ/ })).toHaveAttribute("href", "/mypage");
  });

  it.each(["/login", "/signup", "/admin", "/admin/reports"])(
    "%s では何も描画しない",
    (path) => {
      pathname = path;
      const { container } = render(<AppMenuBar fetchUnreadCount={async () => 0} />);
      expect(container).toBeEmptyDOMElement();
    }
  );

  it("未ログインのホーム（/）では何も描画せず、ログイン済みなら描画する（v3.0）", () => {
    pathname = "/";
    const { container, unmount } = render(<AppMenuBar fetchUnreadCount={async () => 0} isAuthenticated={false} />);
    expect(container).toBeEmptyDOMElement();
    unmount();
    render(<AppMenuBar fetchUnreadCount={async () => 0} isAuthenticated />);
    expect(screen.getByRole("link", { name: /ホーム/ })).toHaveAttribute("aria-current", "page");
  });

  it("現在地の項目に aria-current=page が付く", () => {
    pathname = "/itineraries/abc";
    render(<AppMenuBar fetchUnreadCount={async () => 0} />);
    expect(screen.getByRole("link", { name: /しおり/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /マイページ/ })).not.toHaveAttribute("aria-current");
  });
});

describe("AppMenuBar 未読バッジ（Task2）", () => {
  it("未読0件ではバッジを出さない", async () => {
    const fetchUnreadCount = vi.fn(async () => 0);
    render(<AppMenuBar fetchUnreadCount={fetchUnreadCount} />);
    await waitFor(() => expect(fetchUnreadCount).toHaveBeenCalled());
    expect(screen.queryByLabelText(/未読/)).not.toBeInTheDocument();
  });

  it("未読1件以上でバッジに件数を出す", async () => {
    render(<AppMenuBar fetchUnreadCount={async () => 3} />);
    expect(await screen.findByLabelText("未読3件")).toHaveTextContent("3");
  });

  it("件数取得に失敗してもメニュー自体は表示される", async () => {
    render(
      <AppMenuBar
        fetchUnreadCount={async () => {
          throw new Error("network");
        }}
      />
    );
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByLabelText(/未読/)).not.toBeInTheDocument();
    });
  });

  it("非表示の画面では件数を取得しない", () => {
    pathname = "/login";
    const fetchUnreadCount = vi.fn(async () => 5);
    render(<AppMenuBar fetchUnreadCount={fetchUnreadCount} />);
    expect(fetchUnreadCount).not.toHaveBeenCalled();
  });
});

describe("UnreadBadge", () => {
  it("0以下では描画しない", () => {
    const { container } = render(<UnreadBadge count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("100件以上は 99+ と表示する", () => {
    render(<UnreadBadge count={150} />);
    expect(screen.getByLabelText("未読150件")).toHaveTextContent("99+");
  });
});

describe("AppMenuBar 管理画面導線（Task3）", () => {
  it("メニューバーには管理画面へのリンクを一切出さない", () => {
    render(<AppMenuBar fetchUnreadCount={async () => 0} />);
    const adminLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/admin"));
    expect(adminLinks).toHaveLength(0);
  });
});
