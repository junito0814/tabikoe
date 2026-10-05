import type { SupabaseClient } from "@supabase/supabase-js";
import { createPostPhotoUrls } from "@/lib/posts/signed-url";
import { buildPostCards, type PostCardData, type PostCardRow } from "@/lib/posts/post-cards";
import { DEACTIVATED_DISPLAY_NAME, DEFAULT_AVATAR_URL } from "@/lib/users/constants";
import { getAlbumRole, type AlbumRole } from "./membership";

/**
 * F-RC-02 Task1・Task2: アルバム一覧・詳細・メンバー一覧
 * F-PO-03 Task2: 投稿0件のアルバムは一覧に出さない
 * 出典: docs/tasks/records/album/01-album-detail-handler.md
 *       docs/tasks/records/album/02-album-members-list.md
 *       docs/tasks/posts/post-delete/02-empty-album-hiding.md
 *       要件定義書3.6.2・3.6.3
 */
export interface AlbumSummary {
  tripId: string;
  title: string;
  role: AlbumRole;
  postCount: number;
  memberCount: number;
  /** 代表画像（最新投稿の1点目）。無ければ null */
  coverUrl: string | null;
  /** 最新投稿の日時 */
  updatedAt: string | null;
  /** v3.1: 「日常」アルバム（1 人 1 つ。一覧の先頭に固定、投稿 0 件でも出す） */
  isDaily: boolean;
}

export interface AlbumMember {
  userId: string;
  role: AlbumRole;
  displayName: string;
  avatarUrl: string;
  isDeleted: boolean;
  joinedAt: string;
}

export interface AlbumDetail {
  tripId: string;
  title: string;
  ownerId: string;
  viewerRole: AlbumRole;
  members: AlbumMember[];
  /** 公開・非公開を問わない全投稿（3.6.3） */
  posts: (PostCardData & { visibility: "public" | "private"; tripTitle: string })[];
  /** v3.0（itinerary-basics Task4）: 同じ旅行にしおりがあり、閲覧者がそのメンバーのときだけ ID。それ以外は null */
  itineraryId: string | null;
  /** v3.1: 「日常」なら名前変更・招待・しおりの操作を出さない */
  isDaily: boolean;
}

interface AlbumListRow {
  role: string;
  trips:
    | { id: string; title: string; user_id: string; is_daily: boolean | null; posts: { count: number }[]; album_members: { count: number }[] }
    | { id: string; title: string; user_id: string; is_daily: boolean | null; posts: { count: number }[]; album_members: { count: number }[] }[]
    | null;
}

/**
 * post-delete Task2: 投稿が1件以上あるアルバムだけを残す（`HAVING COUNT(posts) > 0` 相当）。
 * 純粋関数として切り出し、単体テストの対象にする。
 * v3.1（mentoring-7 Task2）: 「日常」（isDaily）は投稿 0 件でも残す。
 *
 * #715（2026-10-05）: **自分がオーナーのアルバムも、投稿 0 件で残す。**
 *
 * 【初心者向け】アルバムを自分で作れるようにしたため（決定事項 82）。これが無いと
 * **作った直後に一覧から消える**。他の人のアルバム（editor・viewer として入っているもの）は
 * 今までどおり 0 件なら出さない ── 自分が作ったものではないので、空のまま並ぶと邪魔になる。
 */
export function filterAlbumsWithPosts<T extends { postCount: number; isDaily?: boolean; role?: string }>(albums: T[]): T[] {
  return albums.filter((album) => album.postCount > 0 || album.isDaily === true || album.role === "owner");
}

/**
 * v3.1: 「日常」を先頭に固定し、残りは最新投稿順（純粋関数）
 * #715（2026-10-05）: 並び順を選べるようにした（「新着順」「古い順」。既定は新着順）。
 * 投稿が無いアルバムは `updatedAt` が null なので、どちらの並びでも末尾に来る。
 */
export type AlbumSort = "newest" | "oldest";

export function sortAlbumsDailyFirst<T extends { isDaily: boolean; updatedAt: string | null }>(
  albums: T[],
  sort: AlbumSort = "newest"
): T[] {
  return [...albums].sort((a, b) => {
    if (a.isDaily !== b.isDaily) return a.isDaily ? -1 : 1;
    // 投稿が無いものは常に末尾（日付で比べられないため）
    if ((a.updatedAt === null) !== (b.updatedAt === null)) return a.updatedAt === null ? 1 : -1;
    if (a.updatedAt === null || b.updatedAt === null) return 0;
    return sort === "newest" ? b.updatedAt.localeCompare(a.updatedAt) : a.updatedAt.localeCompare(b.updatedAt);
  });
}

/** 本人がメンバーのアルバム一覧（投稿1件以上、最新投稿順） */
export async function getAlbumList(admin: SupabaseClient, userId: string, sort: AlbumSort = "newest"): Promise<AlbumSummary[]> {
  const { data, error } = await admin
    .from("album_members")
    .select("role, trips!inner(id, title, user_id, is_daily, posts(count), album_members(count))")
    .eq("user_id", userId)
    // F-AD-05: 非公開化されたアルバムは一覧に出さない
    .is("trips.hidden_at", null);
  if (error) throw error;

  const rows = (data ?? []) as unknown as AlbumListRow[];
  const summaries = rows.flatMap((row) => {
    const trip = Array.isArray(row.trips) ? row.trips[0] : row.trips;
    if (!trip) return [];
    return [
      {
        tripId: trip.id,
        title: trip.title,
        role: row.role as AlbumRole,
        postCount: trip.posts?.[0]?.count ?? 0,
        memberCount: trip.album_members?.[0]?.count ?? 0,
        coverUrl: null as string | null,
        updatedAt: null as string | null,
        isDaily: trip.is_daily === true,
      },
    ];
  });

  const withPosts = filterAlbumsWithPosts(summaries);
  if (withPosts.length === 0) return [];

  // 代表画像: 各旅行の最新投稿の1点目
  const { data: latestPosts, error: postsError } = await admin
    .from("posts")
    .select("trip_id, created_at, post_photos(storage_url, media_type, display_order)")
    .eq("status", "published")
    .in(
      "trip_id",
      withPosts.map((album) => album.tripId)
    )
    .order("created_at", { ascending: false });
  if (postsError) throw postsError;

  const coverPathByTrip = new Map<string, { path: string; createdAt: string }>();
  for (const post of (latestPosts ?? []) as unknown as {
    trip_id: string;
    created_at: string;
    post_photos: { storage_url: string | null; display_order: number }[];
  }[]) {
    if (coverPathByTrip.has(post.trip_id)) continue;
    const first = [...post.post_photos].sort((a, b) => a.display_order - b.display_order)[0];
    if (first?.storage_url) {
      coverPathByTrip.set(post.trip_id, { path: first.storage_url, createdAt: post.created_at });
    }
  }
  const urls = await createPostPhotoUrls(
    admin,
    Array.from(new Set(Array.from(coverPathByTrip.values()).map((item) => item.path)))
  );

  return sortAlbumsDailyFirst(
    withPosts.map((album) => {
      const cover = coverPathByTrip.get(album.tripId);
      return {
        ...album,
        coverUrl: cover ? (urls.get(cover.path) ?? null) : null,
        updatedAt: cover?.createdAt ?? null,
      };
    }),
    sort
  );
}

interface MemberRow {
  user_id: string;
  role: string;
  joined_at: string;
  users:
    | { display_name: string | null; avatar_url: string | null; is_deleted: boolean }
    | { display_name: string | null; avatar_url: string | null; is_deleted: boolean }[]
    | null;
}

/** album_members の行をロール・ユーザー情報付きに整形する（単体テストの対象） */
export function toAlbumMembers(rows: MemberRow[]): AlbumMember[] {
  const order: Record<string, number> = { owner: 0, editor: 1, viewer: 2 };
  return rows
    .map((row) => {
      const user = Array.isArray(row.users) ? row.users[0] : row.users;
      const isDeleted = user?.is_deleted ?? false;
      return {
        userId: row.user_id,
        role: row.role as AlbumRole,
        displayName: isDeleted ? DEACTIVATED_DISPLAY_NAME : (user?.display_name ?? "ユーザー"),
        avatarUrl: isDeleted ? DEFAULT_AVATAR_URL : (user?.avatar_url ?? DEFAULT_AVATAR_URL),
        isDeleted,
        joinedAt: row.joined_at,
      };
    })
    .sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9) || a.joinedAt.localeCompare(b.joinedAt));
}

export async function getAlbumMembers(admin: SupabaseClient, tripId: string): Promise<AlbumMember[]> {
  const { data, error } = await admin
    .from("album_members")
    .select("user_id, role, joined_at, users(display_name, avatar_url, is_deleted)")
    .eq("trip_id", tripId);
  if (error) throw error;
  return toAlbumMembers((data ?? []) as unknown as MemberRow[]);
}

/**
 * アルバム詳細。メンバーでなければ null（404）。
 * メンバー間はブロック関係でも互いの投稿を表示する（3.8.2 の例外）ため、ブロック除外は掛けない。
 */
export async function getAlbumDetail(
  admin: SupabaseClient,
  viewerId: string,
  tripId: string
): Promise<AlbumDetail | null> {
  const role = await getAlbumRole(admin, tripId, viewerId);
  if (!role) return null;

  const { data: trip, error: tripError } = await admin
    .from("trips")
    .select("id, title, user_id, hidden_at, is_daily")
    .eq("id", tripId)
    .maybeSingle();
  if (tripError) throw tripError;
  if (!trip) return null;
  // F-AD-05: 非公開化されたアルバムはオーナー以外に見せない
  if (trip.hidden_at && trip.user_id !== viewerId) return null;

  const [members, postsResult, itineraryMembership] = await Promise.all([
    getAlbumMembers(admin, tripId),
    admin
      .from("posts")
      .select(
        "id, spot_id, user_id, category, visit_date, duration, cost, rating, comment, visibility, created_at, " +
          "spots(name), users(display_name, avatar_url), " +
          "post_photos(storage_url, media_type, display_order), likes(count), comments(count)"
      )
      .eq("trip_id", tripId)
      .eq("status", "published")
      // F-AD-05: 非公開化された投稿は除く
      .is("hidden_at", null)
      .order("created_at", { ascending: false }),
    // しおりのメンバーは アルバムのメンバーとは別（3.11.7）。両方に該当するときだけ「しおりを見る」を出す
    admin.from("itinerary_members").select("itinerary_id, itineraries!inner(trip_id)").eq("user_id", viewerId).eq("itineraries.trip_id", tripId).maybeSingle(),
  ]);
  if (postsResult.error) throw postsResult.error;

  const rows = (postsResult.data ?? []) as unknown as (PostCardRow & { visibility: string })[];
  const cards = await buildPostCards(admin, viewerId, rows);

  return {
    tripId: trip.id,
    title: trip.title,
    ownerId: trip.user_id,
    viewerRole: role,
    members,
    itineraryId: (itineraryMembership.data as { itinerary_id: string } | null)?.itinerary_id ?? null,
    isDaily: (trip as { is_daily?: boolean | null }).is_daily === true,
    posts: cards.map((card, index) => ({
      ...card,
      visibility: rows[index].visibility === "private" ? "private" : "public",
      tripTitle: trip.title,
    })),
  };
}
