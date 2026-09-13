import type { SupabaseClient } from "@supabase/supabase-js";
import { isNotificationType, type NotificationType } from "./catalog";

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
  like: "あなたの投稿にいいねが付きました",
  album_join: "アルバムに新しいメンバーが参加しました",
  role_change: "アルバムでのあなたの権限が変更されました",
  member_removed: "アルバムから削除されました",
  new_owner: "アルバムの新しいオーナーに選出されました",
  report_resolved: "あなたの通報に対応しました（対象を削除しました）",
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
  /** report_resolved 通知: 通報ID → 対象のリンク（対象が消えていれば null） */
  reportTargetHrefs: ReadonlyMap<string, string | null>;
}

export function resolveNotificationHref(
  type: NotificationType,
  relatedId: string | null,
  lookups: NotificationLookups
): { href: string | null; fallbackMessage: string | null } {
  if (!relatedId) return { href: null, fallbackMessage: "対象が見つかりません" };

  switch (type) {
    case "comment": {
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

  const commentIds = ids(["comment"]);
  const likePostIds = ids(["like"]);
  const tripIds = ids(["album_join", "role_change", "member_removed", "new_owner"]);
  const reportIds = ids(["report_resolved"]);

  const [comments, posts, trips, reports] = await Promise.all([
    commentIds.length ? admin.from("comments").select("id, post_id").in("id", commentIds) : Promise.resolve({ data: [] }),
    likePostIds.length ? admin.from("posts").select("id").in("id", likePostIds) : Promise.resolve({ data: [] }),
    tripIds.length ? admin.from("trips").select("id").in("id", tripIds) : Promise.resolve({ data: [] }),
    reportIds.length
      ? admin.from("reports").select("id, target_type, target_id, status").in("id", reportIds)
      : Promise.resolve({ data: [] }),
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
  for (const row of (reports.data ?? []) as { id: string; target_type: string; target_id: string }[]) {
    reportTargetHrefs.set(row.id, null);
    if (row.target_type === "post" || row.target_type === "post_review") {
      if (existingPostIds.has(row.target_id)) reportTargetHrefs.set(row.id, `/posts/${row.target_id}`);
    }
  }

  return {
    commentPostIds,
    existingPostIds,
    existingTripIds: new Set(((trips.data ?? []) as { id: string }[]).map((row) => row.id)),
    reportTargetHrefs,
  };
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
      message: NOTIFICATION_MESSAGES[type],
      href,
      fallbackMessage,
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
