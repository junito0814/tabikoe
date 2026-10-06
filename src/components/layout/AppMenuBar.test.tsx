import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AppMenuBar, resetUnreadCountCache, shouldRefetchUnreadCount, UNREAD_COUNT_TTL_MS, UnreadBadge } from "./AppMenuBar";
import { NOTIFICATIONS_READ_EVENT } from "@/components/notifications/notification-events";

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
  resetUnreadCountCache();
});

describe("AppMenuBar 表示制御（Task1）", () => {
  it("通常画面では4項目のリンクを表示する", async () => {
    render(<AppMenuBar fetchUnreadCount={async () => 0} />);
    const nav = screen.getByRole("navigation", { name: "メインメニュー" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ホーム/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /計画/ })).toHaveAttribute("href", "/itineraries");
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
    expect(screen.getByRole("link", { name: /計画/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /マイページ/ })).not.toHaveAttribute("aria-current");
  });
});

describe("AppMenuBar 未読バッジ（Task2）", () => {
  it("未読 0 件ではバッジを出さない", async () => {
    const fetchUnreadCount = vi.fn(async () => 0);
    render(<AppMenuBar fetchUnreadCount={fetchUnreadCount} />);
    await waitFor(() => expect(fetchUnreadCount).toHaveBeenCalled());
    expect(screen.queryByLabelText(/未読/)).not.toBeInTheDocument();
  });

  it("未読 1 件以上でバッジに件数を出す", async () => {
    render(<AppMenuBar fetchUnreadCount={async () => 3} />);
    expect(await screen.findByLabelText("未読 3 件")).toHaveTextContent("3");
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
    expect(screen.getByLabelText("未読 150 件")).toHaveTextContent("99+");
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

describe("未読件数の間引き（performance Task1）", () => {
  it("前回の取得から 60 秒以内は取り直さず、60 秒を過ぎたら取り直す（純粋関数）", () => {
    const now = 1_000_000;
    expect(shouldRefetchUnreadCount(null, now)).toBe(true);
    expect(shouldRefetchUnreadCount(now - 5_000, now)).toBe(false);
    expect(shouldRefetchUnreadCount(now - UNREAD_COUNT_TTL_MS, now)).toBe(true);
  });

  it("画面遷移をまたいでも 60 秒以内なら API を呼ばず、既読イベントでは必ず取り直す", async () => {
    const fetchUnreadCount = vi.fn(async () => 2);
    const { unmount } = render(<AppMenuBar fetchUnreadCount={fetchUnreadCount} />);
    expect(await screen.findByLabelText("未読 2 件")).toBeInTheDocument();
    unmount();
    pathname = "/mypage";
    render(<AppMenuBar fetchUnreadCount={fetchUnreadCount} />);
    expect(await screen.findByLabelText("未読 2 件")).toBeInTheDocument();
    expect(fetchUnreadCount).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
    await waitFor(() => expect(fetchUnreadCount).toHaveBeenCalledTimes(2));
  });
});
