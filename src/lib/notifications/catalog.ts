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
  // v3.0（itinerary-sharing Task2）。related_id は itinerary_id。20260918000001 で CHECK 制約に追加
  "itinerary_joined",
  "itinerary_member_removed",
  // v3.2（feedback-0919 Task4）。related_id はコメント ID（返信）。20260919000004 で CHECK 制約に追加
  "comment_replied",
  // v3.2（feedback-0919 Task6）。related_id は招待の id（album_invitations／itinerary_invitations）。20260919000005 で CHECK 制約に追加
  "album_invited",
  "itinerary_invited",
  // Phase 17（admin-shell-dashboard Task4）。管理者全員へ。20260927000005 で CHECK 制約に追加
  "admin_report",
  "admin_auto_hidden",
  "admin_suspended",
  // Phase 17（user-management Task2）。本人へ。related_id は本人の ID。20260927000006 で CHECK 制約に追加
  "account_suspended",
  "account_unsuspended",
  // Phase 17（strike-system Task2）。本人へ。related_id は strikes.id。20260927000007 で CHECK 制約に追加
  "moderation_action",
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
  comment_replied: {
    relatedIdRefersTo: "コメントID（返信）",
    recipients: "返信先のコメントの投稿者（返信した本人を除く。投稿者本人には comment 通知だけ）",
    producedBy: "browsing/comments（v3.2）",
  },
  album_invited: {
    relatedIdRefersTo: "album_invitations.id（アプリ内招待）",
    recipients: "招待された本人（通知に「参加する」「辞退」）",
    producedBy: "records/album-collaboration（v3.2）",
  },
  itinerary_invited: {
    relatedIdRefersTo: "itinerary_invitations.id（アプリ内招待）",
    recipients: "招待された本人（通知に「参加する」「辞退」）",
    producedBy: "itinerary/itinerary-sharing（v3.2）",
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
  itinerary_joined: {
    relatedIdRefersTo: "itinerary_id",
    recipients: "参加した本人・しおりのオーナー・既存メンバー",
    producedBy: "itinerary/itinerary-sharing",
  },
  itinerary_member_removed: {
    relatedIdRefersTo: "itinerary_id",
    recipients: "削除されたメンバー本人",
    producedBy: "itinerary/itinerary-sharing",
  },
  admin_report: {
    relatedIdRefersTo: "report_id（新しい通報）",
    recipients: "管理者全員（通報した本人が管理者なら除く）",
    producedBy: "safety/reporting（POST /api/reports）",
  },
  admin_auto_hidden: {
    relatedIdRefersTo: "投稿 ID またはコメント ID（自動で非公開になったもの）",
    recipients: "管理者全員",
    producedBy: "safety/strike-system Task3（自動非公開）",
  },
  admin_suspended: {
    relatedIdRefersTo: "利用者 ID（仮停止した人）",
    recipients: "管理者全員",
    producedBy: "safety/strike-system Task4（仮停止）",
  },
  account_suspended: {
    relatedIdRefersTo: "本人の利用者 ID",
    recipients: "停止された本人（解除後に読める）",
    producedBy: "admin/user-management Task2・safety/strike-system Task4",
  },
  account_unsuspended: {
    relatedIdRefersTo: "本人の利用者 ID",
    recipients: "解除された本人",
    producedBy: "admin/user-management Task2",
  },
  moderation_action: {
    relatedIdRefersTo: "strikes.id（非公開化／削除とストライク）",
    recipients: "対象の投稿者本人（通報者は載せない）",
    producedBy: "safety/strike-system Task2（通報対応の確定）",
  },
};

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === "string" && (NOTIFICATION_TYPES as readonly string[]).includes(value);
}
