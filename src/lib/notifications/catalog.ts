/**
 * F-NT-01 Task2: 通知種別カタログ
 * 出典: docs/tasks/notifications/notification-triggers/02-notification-catalog.md
 *       要件定義書3.9.1（通知の発生条件）
 *
 * 各機能のRoute Handlerは、この表の type と related_id の規則に従って
 * createNotification()（Task1）を呼ぶ。type の値集合はDB側でも
 * CHECK制約（20260912000001）で同じ値に固定している。
 *
 * 運営からのお知らせ（3.9.1）は個人向け notifications ではなく system_announcements に
 * 1件だけ記録するため、このカタログには含まない（F-NT-02 側で読み取り時に合流する）。
 * バッジ獲得（3.7）はトースト表示のみで通知に残さないため、同じく含まない。
 */
export const NOTIFICATION_TYPES = [
  "comment",
  "like",
  "album_join",
  "role_change",
  "member_removed",
  "new_owner",
  "report_resolved",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationTypeSpec {
  /** related_id が指すレコード */
  relatedIdRefersTo: string;
  /** 通知先の決定ルール（3.9.1） */
  recipients: string;
  /** 発生元の担当ストーリー */
  producedBy: string;
}

export const NOTIFICATION_CATALOG: Record<NotificationType, NotificationTypeSpec> = {
  comment: {
    relatedIdRefersTo: "コメントID",
    recipients: "投稿者本人（コメントした本人を除く）",
    producedBy: "browsing/comments",
  },
  like: {
    relatedIdRefersTo: "投稿ID",
    recipients: "投稿者本人（いいねした本人を除く）",
    producedBy: "browsing/likes",
  },
  album_join: {
    relatedIdRefersTo: "trip_id",
    recipients: "参加した本人・アルバムのオーナー・既存メンバー",
    producedBy: "records/album-collaboration",
  },
  role_change: {
    relatedIdRefersTo: "trip_id",
    recipients: "権限を変更されたメンバー本人",
    producedBy: "records/album-collaboration",
  },
  member_removed: {
    relatedIdRefersTo: "trip_id",
    recipients: "削除されたメンバー本人",
    producedBy: "records/album-collaboration",
  },
  new_owner: {
    relatedIdRefersTo: "trip_id",
    recipients: "新オーナーに選出された本人",
    producedBy: "account/account-deletion（deactivate_user() 内で作成、実装済み）",
  },
  report_resolved: {
    relatedIdRefersTo: "report_id",
    recipients: "通報した本人（対応が「削除」の場合のみ）",
    producedBy: "admin/report-handling",
  },
};

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === "string" && (NOTIFICATION_TYPES as readonly string[]).includes(value);
}
