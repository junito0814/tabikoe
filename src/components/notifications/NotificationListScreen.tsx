"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { AnnouncementItem, FeedItem, FeedPage } from "@/lib/notifications/feed";
import { useInfiniteScroll } from "@/components/posts/use-infinite-scroll";
import { dispatchNotificationsRead } from "./notification-events";

export interface NotificationApi {
  fetchPage: (offset: number) => Promise<FeedPage>;
  markRead: (notificationIds: string[]) => Promise<Response>;
}

/**
 * F-NT-02 Task2〜4: 通知一覧画面（SC-14）
 * 出典: docs/tasks/notifications/notification-list/02-notification-list-ui.md
 *       docs/tasks/notifications/notification-list/03-read-status-badge-sync.md
 *       docs/tasks/notifications/notification-list/04-notification-tap-navigation.md
 *
 * - 個人向け通知とお知らせを新着順に混在表示。お知らせには「お知らせ」ラベル、
 *   新着お知らせは「NEW」の文字とアイコンで強調（色だけに依存しない。7.7）
 * - 表示した未読の個人通知は既読化し、メニューバーの未読バッジを更新する
 * - タップで関連画面へ。対象が消えていればその旨を表示。お知らせは画面内モーダルで本文を表示
 */
export function NotificationListScreen({
  initialPage,
  api = defaultApi,
}: {
  initialPage: FeedPage;
  /** 差し替え口（単体テスト用） */
  api?: NotificationApi;
}) {
  const [items, setItems] = useState<FeedItem[]>(initialPage.items);
  const [nextOffset, setNextOffset] = useState<number | null>(initialPage.nextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openAnnouncement, setOpenAnnouncement] = useState<AnnouncementItem | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const markedRef = useRef(new Set<string>());

  // Task3: 表示した未読の個人通知を既読化する（お知らせは対象外）
  const markVisibleAsRead = useCallback(
    async (visible: FeedItem[]) => {
      const unreadIds = visible
        .filter((item): item is Extract<FeedItem, { kind: "notification" }> => item.kind === "notification" && !item.isRead)
        .map((item) => item.id)
        .filter((id) => !markedRef.current.has(id));
      if (unreadIds.length === 0) return;
      unreadIds.forEach((id) => markedRef.current.add(id));
      try {
        const response = await api.markRead(unreadIds);
        if (response.ok) {
          dispatchNotificationsRead();
        }
      } catch (error) {
        if (error instanceof UnauthorizedError) return;
        // 既読化の失敗は一覧の表示を妨げない
      }
    },
    [api]
  );

  useEffect(() => {
    void markVisibleAsRead(initialPage.items);
    // 初期表示分だけを対象にする
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoading || nextOffset === null) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const page = await api.fetchPage(nextOffset);
      setItems((current) => {
        const seen = new Set(current.map((item) => `${item.kind}:${item.id}`));
        return [...current, ...page.items.filter((item) => !seen.has(`${item.kind}:${item.id}`))];
      });
      setNextOffset(page.nextOffset);
      void markVisibleAsRead(page.items);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage(ERROR_MESSAGES.dbLoadFailure);
    } finally {
      setIsLoading(false);
    }
  }, [api, isLoading, nextOffset, markVisibleAsRead]);

  const sentinelRef = useInfiniteScroll(nextOffset !== null && !isLoading, () => void loadMore());

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#FBF6F0] px-4 py-6">
      <div className="flex w-full max-w-[520px] flex-col gap-3">
        <h1 className="text-[18px] font-bold text-[#3D3A35]">通知</h1>

        {fallbackNotice && (
          <p role="status" className="rounded-lg border border-[#E8E1D8] bg-white px-3.5 py-2.5 text-[12px] text-[#3D3A35]">
            {fallbackNotice}
          </p>
        )}

        {items.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-[#9C9488]">通知はありません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) =>
              item.kind === "announcement" ? (
                <li key={`a:${item.id}`}>
                  <button
                    type="button"
                    onClick={() => setOpenAnnouncement(item)}
                    data-announcement={item.id}
                    data-new={item.isNew ? "true" : undefined}
                    className={`flex w-full items-start gap-3 rounded-[12px] border bg-white p-3 text-left ${
                      item.isNew ? "border-[#C4703F]" : "border-[#E8E1D8]"
                    }`}
                  >
                    <span className="mt-0.5 shrink-0" aria-hidden>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M4 10v4a1 1 0 0 0 1 1h3l6 4V5L8 9H5a1 1 0 0 0-1 1z" stroke="#C4703F" strokeWidth="1.8" strokeLinejoin="round" />
                        <path d="M17 9a4 4 0 0 1 0 6" stroke="#C4703F" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[11px]">
                        <span className="rounded-full bg-[#C4703F] px-2 py-0.5 font-semibold text-white">お知らせ</span>
                        {item.isNew && (
                          <span className="inline-flex items-center gap-0.5 font-bold text-[#C4703F]" data-new-badge>
                            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
                              <path d="M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7L12 17.5 5.8 21l1.6-7L2 9.3l7.1-.7z" fill="currentColor" />
                            </svg>
                            NEW
                          </span>
                        )}
                        <span className="ml-auto text-[#9C9488]">{new Date(item.publishedAt).toLocaleDateString("ja-JP")}</span>
                      </span>
                      <span className="mt-1 block truncate text-[13px] font-semibold text-[#3D3A35]">{item.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-[12px] leading-[1.6] text-[#9C9488]">{item.body}</span>
                    </span>
                  </button>
                </li>
              ) : (
                <li key={`n:${item.id}`}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      data-notification={item.id}
                      className={`flex items-start gap-3 rounded-[12px] border border-[#E8E1D8] bg-white p-3 ${
                        item.isRead ? "" : "shadow-[0_2px_16px_rgba(61,58,53,0.08)]"
                      }`}
                    >
                      <NotificationBody item={item} />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      data-notification={item.id}
                      onClick={() => setFallbackNotice(item.fallbackMessage ?? "対象が見つかりません")}
                      className="flex w-full items-start gap-3 rounded-[12px] border border-[#E8E1D8] bg-white p-3 text-left"
                    >
                      <NotificationBody item={item} />
                    </button>
                  )}
                </li>
              )
            )}
          </ul>
        )}

        {errorMessage && <ErrorNotice message={errorMessage} onRetry={() => void loadMore()} />}

        <div ref={sentinelRef} aria-hidden className="h-1" />
        {nextOffset !== null && (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={isLoading}
            className="h-10 w-full rounded-[10px] border border-[#E8E1D8] bg-white text-[13px] font-semibold text-[#3D3A35] disabled:opacity-45"
          >
            {isLoading ? "読み込み中…" : "もっと見る"}
          </button>
        )}
      </div>

      {openAnnouncement && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
          onClick={() => setOpenAnnouncement(null)}
        >
          <div className="max-h-[80vh] w-full max-w-[420px] overflow-y-auto rounded-[14px] bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <p className="mb-1 text-[11px] text-[#9C9488]">
              お知らせ ・ {new Date(openAnnouncement.publishedAt).toLocaleString("ja-JP")}
            </p>
            <h2 id="announcement-title" className="mb-3 text-[16px] font-bold text-[#3D3A35]">{openAnnouncement.title}</h2>
            <p className="whitespace-pre-wrap text-[13px] leading-[1.8] text-[#3D3A35]">{openAnnouncement.body}</p>
            <button
              type="button"
              onClick={() => setOpenAnnouncement(null)}
              className="mt-4 h-10 w-full rounded-[10px] border border-[#E8E1D8] text-[13px] font-medium text-[#3D3A35]"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationBody({ item }: { item: Extract<FeedItem, { kind: "notification" }> }) {
  return (
    <>
      <span className="mt-1 shrink-0" aria-hidden>
        <span className={`block h-2.5 w-2.5 rounded-full ${item.isRead ? "bg-[#E8E1D8]" : "bg-[#C4703F]"}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13px] ${item.isRead ? "text-[#3D3A35]" : "font-semibold text-[#3D3A35]"}`}>
          {item.message}
          {!item.isRead && <span className="sr-only">（未読）</span>}
        </span>
        <span className="mt-0.5 block text-[11px] text-[#9C9488]">
          {new Date(item.createdAt).toLocaleString("ja-JP")}
          {item.fallbackMessage && ` ・ ${item.fallbackMessage}`}
        </span>
      </span>
    </>
  );
}

const defaultApi: NotificationApi = {
  fetchPage: async (offset) => {
    const response = await fetchWithAuthRedirect(`/api/notifications?offset=${offset}`);
    if (!response.ok) throw new Error(`Failed to fetch notifications: ${response.status}`);
    return (await response.json()) as FeedPage;
  },
  markRead: (notificationIds) =>
    fetchWithAuthRedirect("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationIds }),
    }),
};
