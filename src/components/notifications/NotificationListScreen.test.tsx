import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NotificationListScreen, type NotificationApi } from "./NotificationListScreen";
import { NOTIFICATIONS_READ_EVENT } from "./notification-events";
import type { FeedItem } from "@/lib/notifications/feed";

/*
 * loading-feedback Task 9（2026-10-02）: この画面は `PullToRefresh` で包まれ、
 * 引っ張って更新のために `useRouter().refresh()` を使うようになった。
 * 単体テストには Next.js のルーターが無いので、ここで差し替える。
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));


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
  markRead: vi.fn(async () => Response.json({ updated: 1 })),
  markUnread: vi.fn(async () => Response.json({ updated: 1 })),
  markAllRead: vi.fn(async () => Response.json({ updated: 3 })),
  respondInvitation: vi.fn(async () => Response.json({ ok: true, href: "/itineraries/it-1" })),
  ...overrides,
});

/** #711: 行をタップしてモーダルを開く */
function openNotification(id: string) {
  fireEvent.click(document.querySelector(`[data-notification='${id}']`)!);
}

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

  /**
   * #711（2026-10-05）: 一覧を開いただけでは既読にしない（決定事項 79）。
   *
   * 【初心者向け】前は「画面に出した瞬間」に既読にしていた。そのままだと
   * 開いた瞬間に全部既読になり、「未読に戻す」と噛み合わない。
   */
  it("一覧を開いただけでは既読にしない", async () => {
    const markRead = vi.fn(async () => Response.json({ updated: 0 }));
    render(<NotificationListScreen initialPage={{ items, nextOffset: null }} api={api({ markRead })} />);
    await waitFor(() => expect(screen.getByText("いいねが付きました")).toBeInTheDocument());
    expect(markRead).not.toHaveBeenCalled();
  });

  it("モーダルを開いたときに既読にし、バッジ更新の合図を出す", async () => {
    const markRead = vi.fn(async () => Response.json({ updated: 1 }));
    const listener = vi.fn();
    window.addEventListener(NOTIFICATIONS_READ_EVENT, listener);
    render(<NotificationListScreen initialPage={{ items, nextOffset: null }} api={api({ markRead })} />);
    openNotification("n-unread");
    await waitFor(() => expect(markRead).toHaveBeenCalledWith(["n-unread"]));
    await waitFor(() => expect(listener).toHaveBeenCalled());
    window.removeEventListener(NOTIFICATIONS_READ_EVENT, listener);
  });

  it("既読の通知を開いても、もう一度既読にしない", () => {
    const markRead = vi.fn(async () => Response.json({ updated: 0 }));
    render(<NotificationListScreen initialPage={{ items, nextOffset: null }} api={api({ markRead })} />);
    openNotification("n-read");
    expect(markRead).not.toHaveBeenCalled();
  });

  it("未読の行には色が付く", () => {
    render(<NotificationListScreen initialPage={{ items, nextOffset: null }} api={api()} />);
    expect(document.querySelector("[data-notification='n-unread']")!.className).toContain("bg-tint");
    expect(document.querySelector("[data-notification='n-read']")!.className).not.toContain("bg-tint");
  });

  it("「未読に戻す」でバッジも戻る", async () => {
    const markUnread = vi.fn(async () => Response.json({ updated: 1 }));
    render(<NotificationListScreen initialPage={{ items, nextOffset: null }} api={api({ markUnread })} />);
    openNotification("n-read");
    fireEvent.click(screen.getByRole("button", { name: "未読に戻す" }));
    await waitFor(() => expect(markUnread).toHaveBeenCalledWith(["n-read"]));
    await waitFor(() => expect(document.querySelector("[data-notification='n-read']")!.className).toContain("bg-tint"));
  });

  it("「すべて既読にする」で、読み込んでいない分も含めて既読にする", async () => {
    const markAllRead = vi.fn(async () => Response.json({ updated: 3 }));
    render(<NotificationListScreen initialPage={{ items, nextOffset: null }} api={api({ markAllRead })} />);
    fireEvent.click(screen.getByRole("button", { name: "すべて既読にする" }));
    await waitFor(() => expect(markAllRead).toHaveBeenCalled());
    await waitFor(() => expect(document.querySelector("[data-notification='n-unread']")!.className).not.toContain("bg-tint"));
  });

  /** #711: 行き先の有無にかかわらずモーダル（決定事項 79。種類で出し分けない） */
  it("通知をタップするとモーダルが開き、行き先へのボタンが出る", () => {
    render(<NotificationListScreen initialPage={{ items, nextOffset: null }} api={api()} />);
    openNotification("n-unread");
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("いいねが付きました");
    // Bug #471: 「← 通知」で戻れるよう back を付ける
    expect(screen.getByRole("link", { name: "この投稿を見る" })).toHaveAttribute("href", "/posts/p1?back=%2Fnotifications");
  });

  it("行き先が無い通知は、その理由をモーダルに出す（ボタンは出さない）", () => {
    render(<NotificationListScreen initialPage={{ items, nextOffset: null }} api={api()} />);
    openNotification("n-gone");
    expect(screen.getByRole("dialog")).toHaveTextContent("対象は削除されました");
    expect(screen.queryByRole("link", { name: "この投稿を見る" })).toBeNull();
  });

  it("お知らせも同じモーダルで本文を出す。× は右上", () => {
    render(<NotificationListScreen initialPage={{ items, nextOffset: null }} api={api()} />);
    fireEvent.click(document.querySelector("[data-announcement='a-new']")!);
    expect(screen.getByRole("dialog")).toHaveTextContent("新しいお知らせ");
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("モーダルの中で次の通知へ送れる", () => {
    render(<NotificationListScreen initialPage={{ items, nextOffset: null }} api={api()} />);
    openNotification("n-unread");
    expect(screen.getByRole("dialog")).toHaveTextContent("いいねが付きました");
    fireEvent.click(screen.getByRole("button", { name: "次へ →" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("コメントが付きました");
    fireEvent.click(screen.getByRole("button", { name: "← 前へ" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("いいねが付きました");
  });

  it("最初と最後では送れない", () => {
    render(<NotificationListScreen initialPage={{ items, nextOffset: null }} api={api()} />);
    fireEvent.click(document.querySelector("[data-announcement='a-new']")!);
    expect(screen.getByRole("button", { name: "← 前へ" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    fireEvent.click(document.querySelector("[data-announcement='a-old']")!);
    expect(screen.getByRole("button", { name: "次へ →" })).toBeDisabled();
  });
});

describe("NotificationListScreen（v3.2: アプリ内招待の通知）", () => {
  const invited = (id: string, status: "pending" | "accepted") =>
    ({
      kind: "notification",
      id,
      type: "itinerary_invited",
      relatedId: "inv-1",
      isRead: false,
      createdAt: "2026-09-19T00:00:00Z",
      message: "たろうさんがしおり「東京 2 泊 3 日」に招待しました",
      href: status === "accepted" ? "/itineraries/it-1" : null,
      fallbackMessage: null,
      invitation: { kind: "itinerary", status, targetTitle: "東京 2 泊 3 日", inviterName: "たろう" },
    }) as const;

  it("未回答の招待には「参加する」「辞退」が出て、参加すると API が呼ばれ「参加しました」に変わる", async () => {
    const a = api();
    render(<NotificationListScreen initialPage={{ items: [invited("n-inv", "pending")], nextOffset: null }} api={a} />);
    expect(screen.getByText(/たろうさんがしおり「東京 2 泊 3 日」に招待しました/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "参加する" }));
    await waitFor(() => expect(a.respondInvitation).toHaveBeenCalledWith("inv-1", "itinerary", "accept"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "参加する" })).toBeNull());
    expect(screen.getByText(/参加しました/)).toBeInTheDocument();
    // #711: 行き先へはモーダルの中のボタンから（一覧の行はモーダルを開くだけ）
    fireEvent.click(document.querySelector("[data-notification='n-inv']")!);
    expect(screen.getByRole("link", { name: "招待を見る" })).toHaveAttribute("href", "/itineraries/it-1?back=%2Fnotifications");
  });

  it("辞退すると「辞退しました」", async () => {
    const a = api({ respondInvitation: vi.fn(async () => Response.json({ ok: true })) });
    render(<NotificationListScreen initialPage={{ items: [invited("n-inv", "pending")], nextOffset: null }} api={a} />);
    fireEvent.click(screen.getByRole("button", { name: "辞退" }));
    await waitFor(() => expect(a.respondInvitation).toHaveBeenCalledWith("inv-1", "itinerary", "decline"));
    await waitFor(() => expect(screen.getByText(/辞退しました/)).toBeInTheDocument());
  });
});
