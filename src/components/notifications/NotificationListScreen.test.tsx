import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NotificationListScreen, type NotificationApi } from "./NotificationListScreen";
import { NOTIFICATIONS_READ_EVENT } from "./notification-events";
import type { FeedItem } from "@/lib/notifications/feed";

/**
 * 出典: docs/tasks/notifications/notification-list/02-notification-list-ui.md 単体テスト
 * - お知らせ種別のアイテムにラベルが表示されることを検証する
 * - 新着お知らせの強調表示が色以外の手段（アイコン等）を伴うことを検証する
 * 出典: docs/tasks/notifications/notification-list/03-read-status-badge-sync.md
 * - 表示時に未読の個人通知だけを既読化し、バッジ更新の合図を出す
 * 出典: docs/tasks/notifications/notification-list/04-notification-tap-navigation.md 単体テスト
 * - 遷移先が無いケースのフォールバック表示
 */
const items: FeedItem[] = [
  { kind: "announcement", id: "a-new", title: "新しいお知らせ", body: "本文", publishedAt: "2026-09-14T00:00:00Z", isNew: true },
  { kind: "notification", id: "n-unread", type: "like", relatedId: "p1", isRead: false, createdAt: "2026-09-13T00:00:00Z", message: "いいねが付きました", href: "/posts/p1", fallbackMessage: null },
  { kind: "notification", id: "n-read", type: "comment", relatedId: "c1", isRead: true, createdAt: "2026-09-12T00:00:00Z", message: "コメントが付きました", href: "/posts/p1", fallbackMessage: null },
  { kind: "notification", id: "n-gone", type: "report_resolved", relatedId: "r1", isRead: false, createdAt: "2026-09-11T00:00:00Z", message: "通報に対応しました", href: null, fallbackMessage: "対象は削除されました" },
  { kind: "announcement", id: "a-old", title: "古いお知らせ", body: "本文", publishedAt: "2026-08-01T00:00:00Z", isNew: false },
];

const api = (overrides: Partial<NotificationApi> = {}): NotificationApi => ({
  fetchPage: vi.fn(async () => ({ items: [], nextOffset: null })),
  markRead: vi.fn(async () => Response.json({ updated: 2 })),
  ...overrides,
});

describe("NotificationListScreen（SC-14）", () => {
  it("お知らせには「お知らせ」ラベルが付き、新着はアイコン＋NEW の文字で強調される", () => {
    render(<NotificationListScreen initialPage={{ items, nextOffset: null }} api={api()} />);
    expect(screen.getAllByText("お知らせ")).toHaveLength(2);
    const fresh = document.querySelector("[data-announcement='a-new']")!;
    const old = document.querySelector("[data-announcement='a-old']")!;
    expect(fresh.querySelector("[data-new-badge]")).toHaveTextContent("NEW");
    expect(fresh.querySelector("[data-new-badge] svg")).not.toBeNull();
    expect(old.querySelector("[data-new-badge]")).toBeNull();
  });

  it("表示時に未読の個人通知だけを既読化し、バッジ更新イベントを発火する", async () => {
    const markRead = vi.fn(async () => Response.json({ updated: 2 }));
    const listener = vi.fn();
    window.addEventListener(NOTIFICATIONS_READ_EVENT, listener);
    render(<NotificationListScreen initialPage={{ items, nextOffset: null }} api={api({ markRead })} />);
    await waitFor(() => expect(markRead).toHaveBeenCalledWith(["n-unread", "n-gone"]));
    await waitFor(() => expect(listener).toHaveBeenCalled());
    window.removeEventListener(NOTIFICATIONS_READ_EVENT, listener);
  });

  it("遷移先がある通知はリンク、無い通知はタップでフォールバック文言を表示する", () => {
    render(<NotificationListScreen initialPage={{ items, nextOffset: null }} api={api()} />);
    expect(document.querySelector("a[data-notification='n-unread']")).toHaveAttribute("href", "/posts/p1");
    fireEvent.click(document.querySelector("button[data-notification='n-gone']")!);
    expect(screen.getByRole("status")).toHaveTextContent("対象は削除されました");
  });

  it("お知らせをタップすると本文をモーダルで表示する", () => {
    render(<NotificationListScreen initialPage={{ items, nextOffset: null }} api={api()} />);
    fireEvent.click(document.querySelector("[data-announcement='a-new']")!);
    expect(screen.getByRole("dialog")).toHaveTextContent("新しいお知らせ");
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
