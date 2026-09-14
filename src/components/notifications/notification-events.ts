/**
 * F-NT-02 Task3: 既読化後にメニューバーの未読バッジを更新するための合図
 * 出典: docs/tasks/notifications/notification-list/03-read-status-badge-sync.md
 *
 * 通知一覧（SC-14）が既読化 API を呼んだ後に発火し、AppMenuBar が未読件数を取り直す。
 */
export const NOTIFICATIONS_READ_EVENT = "tabikoe:notifications-read";

export function dispatchNotificationsRead(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
  }
}
