"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { appendBackHref } from "@/lib/search/list-state";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { FeedItem, FeedPage } from "@/lib/notifications/feed";
import { useInfiniteScroll } from "@/components/posts/use-infinite-scroll";
import { dispatchNotificationsRead } from "./notification-events";
import { PullToRefresh } from "@/components/layout/PullToRefresh";
import { CloseButton } from "@/components/ui/CloseButton";
import { useCloseOnBack } from "@/lib/ui/use-close-on-back";
import { formatDateTime } from "@/lib/format/date-time";

export interface NotificationApi {
  fetchPage: (offset: number) => Promise<FeedPage>;
  markRead: (notificationIds: string[]) => Promise<Response>;
  /** #711: 未読に戻す */
  markUnread: (notificationIds: string[]) => Promise<Response>;
  /** #711: すべて既読にする（読み込んでいない分も含めて） */
  markAllRead: () => Promise<Response>;
  /** v3.2: アプリ内招待に応答する（参加する／辞退） */
  respondInvitation: (invitationId: string, kind: "album" | "itinerary", action: "accept" | "decline") => Promise<Response>;
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
 *
 * 【初心者向け】一覧の要素は `kind` で 2 種類に分かれる（"notification"＝個人向け、"announcement"＝お知らせ）。
 * 既読化は「画面に出した瞬間」に行い、`markedRef`（Set）で同じ id を二度送らないようにしている。
 * 既読化に成功したら `dispatchNotificationsRead()` でカスタムイベントを飛ばし、メニューバーの未読バッジが
 * それを聞いて件数を取り直す（親子関係のないコンポーネント同士の連絡手段）。
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
  /*
   * #711: 開いている通知の位置（一覧の何番目か）。
   *
   * 【初心者向け】中身そのものではなく**位置**を持つのは、「次へ」で隣へ送るため。
   * 既読にしたときに一覧の中身を書き換えるので、位置で持っておくと常に最新が出る。
   */
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  /** v3.2: 応答中の招待通知の id */
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // v3.2（feedback-0919 Task6）: 招待の通知の「参加する」「辞退」。成功したら通知の状態を書き換える
  const respond = async (item: Extract<FeedItem, { kind: "notification" }>, action: "accept" | "decline") => {
    if (!item.invitation || !item.relatedId || respondingId) return;
    setRespondingId(item.id);
    setErrorMessage(null);
    try {
      const response = await api.respondInvitation(item.relatedId, item.invitation.kind, action);
      if (!response.ok) {
        setErrorMessage(response.status === 410 ? "この招待は期限切れです" : response.status === 409 ? "この招待は回答済みか取り消されています" : "招待に応答できませんでした");
        return;
      }
      const data = (await response.json()) as { href?: string };
      setItems((current) =>
        current.map((entry) =>
          entry.kind === "notification" && entry.id === item.id && entry.invitation
            ? { ...entry, invitation: { ...entry.invitation, status: action === "accept" ? "accepted" : "declined" }, href: action === "accept" ? (data.href ?? null) : null }
            : entry
        )
      );
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("招待に応答できませんでした");
    } finally {
      setRespondingId(null);
    }
  };
  /** #711: モーダルを開く。個人通知で未読なら、このとき既読にする */
  const openAt = (index: number) => {
    setOpenIndex(index);
    const item = items[index];
    if (item?.kind !== "notification" || item.isRead) return;
    void (async () => {
      try {
        const response = await api.markRead([item.id]);
        if (!response.ok) return;
        setItems((current) => current.map((entry) => (entry.kind === "notification" && entry.id === item.id ? { ...entry, isRead: true } : entry)));
        dispatchNotificationsRead();
      } catch (error) {
        if (error instanceof UnauthorizedError) return;
        // 既読にできなくても読むのは妨げない
      }
    })();
  };

  /** #711: 未読に戻す（モーダルの中だけに置く） */
  const markUnread = async (item: Extract<FeedItem, { kind: "notification" }>) => {
    try {
      const response = await api.markUnread([item.id]);
      if (!response.ok) return;
      setItems((current) => current.map((entry) => (entry.kind === "notification" && entry.id === item.id ? { ...entry, isRead: false } : entry)));
      dispatchNotificationsRead();
      setOpenIndex(null);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("未読に戻せませんでした");
    }
  };

  /** #711: すべて既読にする。読み込んでいない分も含めて */
  const markAllRead = async () => {
    if (isMarkingAll) return;
    setIsMarkingAll(true);
    try {
      const response = await api.markAllRead();
      if (!response.ok) return;
      setItems((current) => current.map((entry) => (entry.kind === "notification" ? { ...entry, isRead: true } : entry)));
      dispatchNotificationsRead();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("既読にできませんでした");
    } finally {
      setIsMarkingAll(false);
    }
  };

  /*
   * #711: 一覧を開いただけでは既読にしない。
   *
   * 【初心者向け】前は「画面に出した瞬間」に既読にしていた。そのままだと
   * **開いた瞬間に全部既読**になり、「未読に戻す」と噛み合わない（戻してもすぐ既読に戻る）。
   * いまはモーダルを開いたときだけ既読にする。
   */

  const loadMore = useCallback(async () => {
    if (isLoading || nextOffset === null) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const page = await api.fetchPage(nextOffset);
      // 追加読み込み中に新しい通知が増えるとページがずれて同じ通知が二度届くことがあるので、id で重複を除く
      setItems((current) => {
        const seen = new Set(current.map((item) => `${item.kind}:${item.id}`));
        return [...current, ...page.items.filter((item) => !seen.has(`${item.kind}:${item.id}`))];
      });
      setNextOffset(page.nextOffset);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage(ERROR_MESSAGES.dbLoadFailure);
    } finally {
      setIsLoading(false);
    }
  }, [api, isLoading, nextOffset]);

  const sentinelRef = useInfiniteScroll(nextOffset !== null && !isLoading, () => void loadMore());

  /** いま開いている通知（位置から引く。既読にした直後も最新が出る） */
  const open = openIndex === null ? null : (items[openIndex] ?? null);
  // #796: Android の戻るキー（iOS の端スワイプ）でモーダルだけ閉じる（画面ごと通知一覧から出ない）
  useCloseOnBack(open !== null, () => setOpenIndex(null));

  return (
    <PullToRefresh>
      <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
        <div className="flex w-full max-w-[520px] flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-[18px] font-bold text-ink">通知</h1>
            {/* #711: 自動既読をやめたので、まとめて消す道を右上に置く（決定事項 79） */}
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={isMarkingAll}
              className="h-8 shrink-0 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-ink disabled:opacity-45"
            >
              {isMarkingAll ? "既読にしています…" : "すべて既読にする"}
            </button>
          </div>


          {items.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-muted">通知はありません</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((item, index) =>
                item.kind === "announcement" ? (
                  <li key={`a:${item.id}`}>
                    <button
                      type="button"
                      onClick={() => openAt(index)}
                      data-announcement={item.id}
                      data-new={item.isNew ? "true" : undefined}
                      className={`flex w-full items-start gap-3 rounded-[12px] border bg-surface p-3 text-left ${
                        item.isNew ? "border-accent" : "border-line"
                      }`}
                    >
                      <span className="mt-0.5 shrink-0" aria-hidden>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <path d="M4 10v4a1 1 0 0 0 1 1h3l6 4V5L8 9H5a1 1 0 0 0-1 1z" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" />
                          <path d="M17 9a4 4 0 0 1 0 6" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-[11px]">
                          <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-white">お知らせ</span>
                          {item.isNew && (
                            <span className="inline-flex items-center gap-0.5 font-bold text-accent" data-new-badge>
                              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
                                <path d="M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7L12 17.5 5.8 21l1.6-7L2 9.3l7.1-.7z" fill="currentColor" />
                              </svg>
                              NEW
                            </span>
                          )}
                          <span className="ml-auto text-muted">{formatDateTime(item.publishedAt)}</span>
                        </span>
                        <span className="mt-1 block truncate text-[13px] font-semibold text-ink">{item.title}</span>
                        <span className="mt-0.5 line-clamp-2 block text-[12px] leading-[1.6] text-muted">{item.body}</span>
                      </span>
                    </button>
                  </li>
                ) : (
                  <li key={`n:${item.id}`}>
                    {item.invitation && item.invitation.status === "pending" ? (
                      // v3.2: 未回答の招待はリンクにせず、その場で「参加する」「辞退」
                      <div data-notification={item.id} className={`flex flex-col gap-2 rounded-[12px] border border-line bg-surface p-3 ${item.isRead ? "" : "shadow-card"}`}>
                        <div className="flex items-start gap-3">
                          <NotificationBody item={item} />
                        </div>
                        <div className="flex gap-2 pl-6">
                          <button
                            type="button"
                            onClick={() => void respond(item, "accept")}
                            disabled={respondingId !== null}
                            className="h-9 rounded-full bg-accent px-4 text-[12px] font-bold text-white disabled:opacity-45"
                          >
                            {respondingId === item.id ? "処理中…" : "参加する"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void respond(item, "decline")}
                            disabled={respondingId !== null}
                            className="h-9 rounded-full border border-line bg-surface px-4 text-[12px] font-semibold text-ink disabled:opacity-45"
                          >
                            辞退
                          </button>
                        </div>
                      </div>
                    ) : (
                      /*
                       * #711: 行き先の有無にかかわらず**モーダルを開く**（決定事項 79。種類で出し分けない）。
                       * 行き先へは、モーダルの中のボタンから行く。
                       */
                      <button
                        type="button"
                        data-notification={item.id}
                        onClick={() => openAt(index)}
                        className={`flex w-full items-start gap-3 rounded-[12px] border border-line p-3 text-left ${
                          item.isRead ? "border-line bg-surface" : "border-accent/40 bg-tint shadow-card"
                        }`}
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
              className="h-10 w-full rounded-[10px] border border-line bg-surface text-[13px] font-semibold text-ink disabled:opacity-45"
            >
              {isLoading ? "読み込み中…" : "もっと見る"}
            </button>
          )}
        </div>

        {/*
          * #711: 通知もお知らせも、同じモーダルで読む（決定事項 79。種類で出し分けない）。
          * 中身は 本文・行き先へ行くボタン・未読に戻す・次へ／前へ。
          * × は右上（要件 4.5.13）。下に全幅の「閉じる」は置かない。
          */}
        {open && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
            onClick={() => setOpenIndex(null)}
          >
            <div
              className="max-h-[80vh] w-full max-w-[420px] overflow-y-auto rounded-[14px] bg-surface p-4 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-1 flex items-start gap-2">
                <p className="flex-1 text-[11px] text-muted">
                  {open.kind === "announcement"
                    ? `お知らせ ・ ${formatDateTime(open.publishedAt)}`
                    : `通知 ・ ${formatDateTime(open.createdAt)}`}
                </p>
                <CloseButton onClick={() => setOpenIndex(null)} />
              </div>
              <h2 id="notification-modal-title" className="mb-2 text-[15px] font-bold text-ink">
                {open.kind === "announcement" ? open.title : open.message}
              </h2>
              {open.kind === "announcement" && (
                <p className="whitespace-pre-wrap text-[13px] leading-[1.8] text-ink">{open.body}</p>
              )}
              {open.kind === "notification" && open.fallbackMessage && (
                <p className="text-[12px] leading-[1.7] text-muted">{open.fallbackMessage}</p>
              )}

              <div className="mt-3 flex flex-col gap-2">
                {open.kind === "notification" && open.href && (
                  <Link
                    href={appendBackHref(open.href, "/notifications")}
                    prefetch={false}
                    className="h-10 rounded-[10px] bg-accent text-center text-[13px] font-bold leading-10 text-white"
                  >
                    {open.invitation ? "招待を見る" : "この投稿を見る"}
                  </Link>
                )}
                {open.kind === "notification" && open.isRead && (
                  <button
                    type="button"
                    onClick={() => void markUnread(open)}
                    className="h-10 rounded-[10px] border border-line text-[13px] font-semibold text-ink"
                  >
                    未読に戻す
                  </button>
                )}
              </div>

              {/* #711: 閉じずに読み進められる（写真の拡大と同じ考え方） */}
              <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-[12px]">
                <button
                  type="button"
                  onClick={() => openAt(openIndex! - 1)}
                  disabled={openIndex === 0}
                  className="h-8 rounded-full px-3 font-semibold text-ink disabled:opacity-35"
                >
                  ← 前へ
                </button>
                <span className="text-muted">
                  {openIndex! + 1} / {items.length}
                </span>
                <button
                  type="button"
                  onClick={() => openAt(openIndex! + 1)}
                  disabled={openIndex! >= items.length - 1}
                  className="h-8 rounded-full px-3 font-semibold text-ink disabled:opacity-35"
                >
                  次へ →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}

function NotificationBody({ item }: { item: Extract<FeedItem, { kind: "notification" }> }) {
  return (
    <>
      <span className="mt-1 shrink-0" aria-hidden>
        <span className={`block h-2.5 w-2.5 rounded-full ${item.isRead ? "bg-line" : "bg-accent"}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13px] ${item.isRead ? "text-ink" : "font-semibold text-ink"}`}>
          {item.message}
          {!item.isRead && <span className="sr-only">（未読）</span>}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted">
          {formatDateTime(item.createdAt)}
          {item.fallbackMessage && ` ・ ${item.fallbackMessage}`}
          {item.invitation && item.invitation.status !== "pending" && ` ・ ${INVITATION_STATUS_LABELS[item.invitation.status]}`}
        </span>
      </span>
    </>
  );
}

/** v3.2: 回答済みの招待の表示 */
const INVITATION_STATUS_LABELS: Record<"accepted" | "declined" | "revoked" | "expired", string> = {
  accepted: "参加しました",
  declined: "辞退しました",
  revoked: "取り消されました",
  expired: "期限切れ",
};

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
  markUnread: (notificationIds) =>
    fetchWithAuthRedirect("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationIds, read: false }),
    }),
  markAllRead: () =>
    fetchWithAuthRedirect("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }),
  respondInvitation: (invitationId, kind, action) =>
    fetchWithAuthRedirect(`/api/invitation-responses/${invitationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, action }),
    }),
};
