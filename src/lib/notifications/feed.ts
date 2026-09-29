import type { SupabaseClient } from "@supabase/supabase-js";
import { isNotificationType, type NotificationType } from "./catalog";
import { REPORT_TARGET_LABELS, type ReportTargetType } from "@/lib/reports/constants";

/**
 * F-NT-02 Task1・Task4・Task5: 通知一覧（個人向け通知＋お知らせのマージ、遷移先、90日フィルタ）
 * 出典: docs/tasks/notifications/notification-list/01-notification-list-api.md
 *       docs/tasks/notifications/notification-list/04-notification-tap-navigation.md
 *       docs/tasks/notifications/notification-list/05-retention-cutoff.md
 *       要件定義書3.9.2
 */
export const NOTIFICATIONS_PAGE_SIZE = 20;

/** 個人向け通知の保存期間（日）。超えたものは一覧に出さない（物理削除はしない） */
export const NOTIFICATION_RETENTION_DAYS = 90;

/** お知らせを「新着」として強調する期間（日） */
export const ANNOUNCEMENT_NEW_DAYS = 7;

export interface PersonalNotificationItem {
  kind: "notification";
  id: string;
  type: NotificationType;
  relatedId: string | null;
  isRead: boolean;
  createdAt: string;
  message: string;
  /** 遷移先。対象が消えている等で無ければ null（fallbackMessage を表示） */
  href: string | null;
  fallbackMessage: string | null;
  /** v3.2: アプリ内招待の通知だけ持つ。通知一覧に「参加する」「辞退」を出す */
  invitation?: { kind: "album" | "itinerary"; status: "pending" | "accepted" | "declined" | "revoked" | "expired"; targetTitle: string; inviterName: string };
}

export interface AnnouncementItem {
  kind: "announcement";
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  isNew: boolean;
}

export type FeedItem = PersonalNotificationItem | AnnouncementItem;

export interface FeedPage {
  items: FeedItem[];
  nextOffset: number | null;
}

export const NOTIFICATION_MESSAGES: Record<NotificationType, string> = {
  comment: "あなたの投稿にコメントが付きました",
  comment_replied: "あなたのコメントに返信が付きました",
  album_invited: "アルバムに招待されました",
  itinerary_invited: "しおりに招待されました",
  like: "あなたの投稿にいいねが付きました",
  album_join: "アルバムに新しいメンバーが参加しました",
  role_change: "アルバムでのあなたの権限が変更されました",
  member_removed: "アルバムから削除されました",
  new_owner: "アルバムの新しいオーナーに選出されました",
  report_resolved: "あなたの通報に対応しました（対象を削除しました）",
  itinerary_joined: "しおりに新しいメンバーが参加しました",
  itinerary_member_removed: "しおりから削除されました",
  // Phase 17: 管理者向け（通報の対象名は adminMessage() で足す）
  admin_report: "新しい通報が届きました",
  admin_auto_hidden: "投稿が自動で非公開になりました（確認待ち）",
  admin_suspended: "利用者を仮停止しました（確認待ち）",
  account_suspended: "アカウントが停止されました。理由はマイページの「アカウントの状態」で確認できます",
  account_unsuspended: "アカウントの停止が解除されました",
};

export function retentionCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/** 90日を超えた個人向け通知を落とす（単体テストの対象）。お知らせは対象外 */
export function withinRetention(createdAt: string, now: Date = new Date()): boolean {
  return new Date(createdAt).getTime() >= retentionCutoff(now).getTime();
}

export function isNewAnnouncement(publishedAt: string, now: Date = new Date()): boolean {
  const age = now.getTime() - new Date(publishedAt).getTime();
  return age >= 0 && age <= ANNOUNCEMENT_NEW_DAYS * 24 * 60 * 60 * 1000;
}

function timestampOf(item: FeedItem): string {
  return item.kind === "announcement" ? item.publishedAt : item.createdAt;
}

/** 個人向け通知とお知らせを新着順に1本の列へ（単体テストの対象） */
export function mergeFeed(notifications: PersonalNotificationItem[], announcements: AnnouncementItem[]): FeedItem[] {
  return [...notifications, ...announcements].sort((a, b) => timestampOf(b).localeCompare(timestampOf(a)));
}

/** 20件区切り（単体テストの対象） */
export function paginateFeed(items: FeedItem[], offset: number, limit: number = NOTIFICATIONS_PAGE_SIZE): FeedPage {
  const page = items.slice(offset, offset + limit);
  return { items: page, nextOffset: offset + limit < items.length ? offset + limit : null };
}

/**
 * Task4: type・related_id → 遷移先。
 * `lookups` は related_id から辿った先（コメント→投稿ID、通報→対象のリンク）。無ければ削除済みとして扱う。
 */
export interface NotificationLookups {
  /** comment 通知: コメントID → 投稿ID */
  commentPostIds: ReadonlyMap<string, string>;
  /** 存在する投稿ID */
  existingPostIds: ReadonlySet<string>;
  /** 存在する旅行ID */
  existingTripIds: ReadonlySet<string>;
  /** 存在するしおりID（v3.0） */
  existingItineraryIds: ReadonlySet<string>;
  /** report_resolved 通知: 通報ID → 対象のリンク（対象が消えていれば null） */
  reportTargetHrefs: ReadonlyMap<string, string | null>;
  /** Phase 17: admin_report 通知: 通報ID → 対象種別（存在する通報だけ） */
  reportTargetTypes?: ReadonlyMap<string, string>;
  /** Phase 17: admin_suspended 通知: 存在する利用者ID */
  existingUserIds?: ReadonlySet<string>;
  /** v3.2: album_invited／itinerary_invited 通知: 招待ID → 状態・対象名・招待した人 */
  invitations?: ReadonlyMap<string, NonNullable<PersonalNotificationItem["invitation"]> & { targetId: string }>;
}

export function resolveNotificationHref(
  type: NotificationType,
  relatedId: string | null,
  lookups: NotificationLookups
): { href: string | null; fallbackMessage: string | null } {
  if (!relatedId) return { href: null, fallbackMessage: "対象が見つかりません" };

  switch (type) {
    case "comment":
    case "comment_replied": {
      const postId = lookups.commentPostIds.get(relatedId);
      return postId ? { href: `/posts/${postId}`, fallbackMessage: null } : { href: null, fallbackMessage: "このコメントは削除されました" };
    }
    case "like":
      return lookups.existingPostIds.has(relatedId)
        ? { href: `/posts/${relatedId}`, fallbackMessage: null }
        : { href: null, fallbackMessage: "この投稿は削除されました" };
    case "album_join":
    case "role_change":
    case "member_removed":
    case "new_owner":
      return lookups.existingTripIds.has(relatedId)
        ? { href: `/albums/${relatedId}`, fallbackMessage: null }
        : { href: null, fallbackMessage: "このアルバムは存在しません" };
    case "report_resolved": {
      const href = lookups.reportTargetHrefs.get(relatedId) ?? null;
      return href ? { href, fallbackMessage: null } : { href: null, fallbackMessage: "対象は削除されました" };
    }
    case "itinerary_joined":
    case "itinerary_member_removed":
      return lookups.existingItineraryIds.has(relatedId)
        ? { href: `/itineraries/${relatedId}`, fallbackMessage: null }
        : { href: null, fallbackMessage: "このしおりは存在しません" };
    // Phase 17（admin-shell-dashboard Task4）: 管理者向け。管理画面の該当ページへ
    case "admin_report":
      return lookups.reportTargetTypes?.has(relatedId)
        ? { href: `/admin/reports/${relatedId}`, fallbackMessage: null }
        : { href: null, fallbackMessage: "この通報は削除されました" };
    case "admin_auto_hidden":
      return { href: "/admin/hidden", fallbackMessage: null };
    // Phase 17（user-management Task2）: 本人向け。アカウントの状態（SC-28、#557）へ
    case "account_suspended":
    case "account_unsuspended":
      return { href: "/account/status", fallbackMessage: null };
    case "admin_suspended":
      return lookups.existingUserIds?.has(relatedId)
        ? { href: `/admin/users/${relatedId}`, fallbackMessage: null }
        : { href: null, fallbackMessage: "この利用者は退会しました" };
    case "album_invited":
    case "itinerary_invited": {
      // v3.2: 未回答なら通知一覧の「参加する」「辞退」で応答する（リンクにしない）。回答済みなら対象へ
      const invitation = lookups.invitations?.get(relatedId);
      if (!invitation) return { href: null, fallbackMessage: "この招待は取り消されました" };
      if (invitation.status === "accepted") return { href: type === "album_invited" ? `/albums/${invitation.targetId}` : `/itineraries/${invitation.targetId}`, fallbackMessage: null };
      return { href: null, fallbackMessage: null };
    }
  }
}

interface NotificationRow {
  id: string;
  type: string;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

/** 通知行の related_id を実体に解決する */
async function buildLookups(admin: SupabaseClient, rows: NotificationRow[]): Promise<NotificationLookups> {
  const ids = (types: string[]) =>
    Array.from(new Set(rows.filter((row) => types.includes(row.type) && row.related_id).map((row) => row.related_id!)));

  const commentIds = ids(["comment", "comment_replied"]);
  const likePostIds = ids(["like"]);
  const tripIds = ids(["album_join", "role_change", "member_removed", "new_owner"]);
  const reportIds = ids(["report_resolved", "admin_report"]);
  const adminUserIds = ids(["admin_suspended"]);
  const itineraryIds = ids(["itinerary_joined", "itinerary_member_removed"]);
  const albumInvitationIds = ids(["album_invited"]);
  const itineraryInvitationIds = ids(["itinerary_invited"]);

  const [comments, posts, trips, reports, itineraries, albumInvitations, itineraryInvitations, adminUsers] = await Promise.all([
    commentIds.length ? admin.from("comments").select("id, post_id").in("id", commentIds) : Promise.resolve({ data: [] }),
    likePostIds.length ? admin.from("posts").select("id").in("id", likePostIds) : Promise.resolve({ data: [] }),
    tripIds.length ? admin.from("trips").select("id").in("id", tripIds) : Promise.resolve({ data: [] }),
    reportIds.length
      ? admin.from("reports").select("id, target_type, target_id, status").in("id", reportIds)
      : Promise.resolve({ data: [] }),
    itineraryIds.length ? admin.from("itineraries").select("id").in("id", itineraryIds) : Promise.resolve({ data: [] }),
    // v3.2: アプリ内招待（状態・対象名・招待した人）
    albumInvitationIds.length
      ? admin.from("album_invitations").select("id, trip_id, status, expires_at, trips(title), users:created_by(display_name)").in("id", albumInvitationIds)
      : Promise.resolve({ data: [] }),
    itineraryInvitationIds.length
      ? admin.from("itinerary_invitations").select("id, itinerary_id, status, expires_at, itineraries(trips(title)), users:created_by(display_name)").in("id", itineraryInvitationIds)
      : Promise.resolve({ data: [] }),
    adminUserIds.length ? admin.from("users").select("id").in("id", adminUserIds) : Promise.resolve({ data: [] }),
  ]);

  const commentPostIds = new Map<string, string>();
  for (const row of (comments.data ?? []) as { id: string; post_id: string }[]) {
    commentPostIds.set(row.id, row.post_id);
  }

  // コメントが残っている投稿も存在確認に含める
  const postIdsToCheck = Array.from(new Set([...likePostIds, ...commentPostIds.values()]));
  const existingPostIds = new Set<string>(((posts.data ?? []) as { id: string }[]).map((row) => row.id));
  const missingCheck = postIdsToCheck.filter((id) => !existingPostIds.has(id) && !likePostIds.includes(id));
  if (missingCheck.length > 0) {
    const { data } = await admin.from("posts").select("id").in("id", missingCheck);
    for (const row of (data ?? []) as { id: string }[]) existingPostIds.add(row.id);
  }
  for (const [commentId, postId] of Array.from(commentPostIds.entries())) {
    if (!existingPostIds.has(postId)) commentPostIds.delete(commentId);
  }

  // 通報対応（削除）の対象は消えているのが通常。残っていればリンクする
  const reportTargetHrefs = new Map<string, string | null>();
  const reportTargetTypes = new Map<string, string>();
  for (const row of (reports.data ?? []) as { id: string; target_type: string; target_id: string }[]) {
    reportTargetHrefs.set(row.id, null);
    reportTargetTypes.set(row.id, row.target_type);
    if (row.target_type === "post" || row.target_type === "post_review") {
      if (existingPostIds.has(row.target_id)) reportTargetHrefs.set(row.id, `/posts/${row.target_id}`);
    }
  }

  return {
    commentPostIds,
    existingPostIds,
    existingTripIds: new Set(((trips.data ?? []) as { id: string }[]).map((row) => row.id)),
    existingItineraryIds: new Set(((itineraries.data ?? []) as { id: string }[]).map((row) => row.id)),
    reportTargetHrefs,
    reportTargetTypes,
    existingUserIds: new Set(((adminUsers.data ?? []) as { id: string }[]).map((row) => row.id)),
    invitations: buildInvitationLookups(albumInvitations.data ?? [], itineraryInvitations.data ?? []),
  };
}

/** v3.2: 招待の行 → 通知一覧が使う形（期限切れは expired に読み替える） */
export function buildInvitationLookups(
  albumRows: unknown[],
  itineraryRows: unknown[],
  now: Date = new Date()
): Map<string, NonNullable<PersonalNotificationItem["invitation"]> & { targetId: string }> {
  const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null));
  const status = (raw: string, expiresAt: string) => (raw === "pending" && new Date(expiresAt).getTime() < now.getTime() ? "expired" : (raw as "pending" | "accepted" | "declined" | "revoked"));
  const map = new Map<string, NonNullable<PersonalNotificationItem["invitation"]> & { targetId: string }>();
  for (const row of albumRows as { id: string; trip_id: string; status: string; expires_at: string; trips: { title: string } | { title: string }[] | null; users: { display_name: string | null } | { display_name: string | null }[] | null }[]) {
    map.set(row.id, { kind: "album", status: status(row.status, row.expires_at), targetId: row.trip_id, targetTitle: one(row.trips)?.title ?? "アルバム", inviterName: one(row.users)?.display_name ?? "ユーザー" });
  }
  for (const row of itineraryRows as { id: string; itinerary_id: string; status: string; expires_at: string; itineraries: { trips: { title: string } | { title: string }[] | null } | { trips: { title: string } | { title: string }[] | null }[] | null; users: { display_name: string | null } | { display_name: string | null }[] | null }[]) {
    map.set(row.id, { kind: "itinerary", status: status(row.status, row.expires_at), targetId: row.itinerary_id, targetTitle: one(one(row.itineraries)?.trips)?.title ?? "しおり", inviterName: one(row.users)?.display_name ?? "ユーザー" });
  }
  return map;
}

/** 本人の通知（90日以内）＋公開済みお知らせを新着順に1ページ返す */
export async function getNotificationFeed(
  admin: SupabaseClient,
  userId: string,
  offset: number,
  now: Date = new Date()
): Promise<FeedPage> {
  const [notificationsResult, announcementsResult] = await Promise.all([
    admin
      .from("notifications")
      .select("id, type, related_id, is_read, created_at")
      .eq("user_id", userId)
      // Task5: 90日を超えたものは出さない
      .gte("created_at", retentionCutoff(now).toISOString())
      .order("created_at", { ascending: false }),
    admin
      .from("system_announcements")
      .select("id, title, body, published_at")
      .lte("published_at", now.toISOString())
      .order("published_at", { ascending: false }),
  ]);
  if (notificationsResult.error) throw notificationsResult.error;
  if (announcementsResult.error) throw announcementsResult.error;

  const rows = ((notificationsResult.data ?? []) as NotificationRow[]).filter((row) => isNotificationType(row.type));
  const lookups = await buildLookups(admin, rows);

  const notifications: PersonalNotificationItem[] = rows.map((row) => {
    const type = row.type as NotificationType;
    const { href, fallbackMessage } = resolveNotificationHref(type, row.related_id, lookups);
    return {
      kind: "notification",
      id: row.id,
      type,
      relatedId: row.related_id,
      isRead: row.is_read,
      createdAt: row.created_at,
      message: invitationMessage(type, row.related_id, lookups) ?? adminReportMessage(type, row.related_id, lookups) ?? NOTIFICATION_MESSAGES[type],
      href,
      fallbackMessage,
      ...(row.related_id && lookups.invitations?.get(row.related_id) && (type === "album_invited" || type === "itinerary_invited")
        ? { invitation: pick(lookups.invitations.get(row.related_id)!) }
        : {}),
    };
  });

  const announcements: AnnouncementItem[] = ((announcementsResult.data ?? []) as {
    id: string;
    title: string;
    body: string;
    published_at: string;
  }[]).map((row) => ({
    kind: "announcement",
    id: row.id,
    title: row.title,
    body: row.body,
    publishedAt: row.published_at,
    isNew: isNewAnnouncement(row.published_at, now),
  }));

  return paginateFeed(mergeFeed(notifications, announcements), offset);
}

/** Phase 17: 新しい通報の通知は「新しい通報：〈対象〉」と対象の種別を足す（純粋関数） */
export function adminReportMessage(type: NotificationType, relatedId: string | null, lookups: NotificationLookups): string | null {
  if (type !== "admin_report" || !relatedId) return null;
  const targetType = lookups.reportTargetTypes?.get(relatedId);
  if (!targetType || !(targetType in REPORT_TARGET_LABELS)) return null;
  return `新しい通報：${REPORT_TARGET_LABELS[targetType as ReportTargetType]}`;
}

/** v3.2: 招待の通知は「〈名前〉さんがしおり『…』に招待しました」と具体的に */
function invitationMessage(type: NotificationType, relatedId: string | null, lookups: NotificationLookups): string | null {
  if ((type !== "album_invited" && type !== "itinerary_invited") || !relatedId) return null;
  const invitation = lookups.invitations?.get(relatedId);
  if (!invitation) return null;
  return `${invitation.inviterName}さんが${invitation.kind === "album" ? "アルバム" : "しおり"}「${invitation.targetTitle}」に招待しました`;
}

function pick(value: NonNullable<PersonalNotificationItem["invitation"]> & { targetId: string }): NonNullable<PersonalNotificationItem["invitation"]> {
  return { kind: value.kind, status: value.status, targetTitle: value.targetTitle, inviterName: value.inviterName };
}
