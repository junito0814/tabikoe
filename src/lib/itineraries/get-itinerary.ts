import type { SupabaseClient } from "@supabase/supabase-js";
import { DEACTIVATED_DISPLAY_NAME, DEFAULT_AVATAR_URL } from "@/lib/users/constants";
import { dayCount, dayDate } from "./day-utils";
import { getItineraryRole, type ItineraryRole } from "./membership";
import { orderSpots, toHHMM } from "./order-spots";

/**
 * itinerary-basics Task1 / itinerary-map-and-post Task2: しおりの取得（一覧・詳細）
 * 出典: docs/tasks/itinerary/itinerary-basics/01-itinerary-crud-api.md
 *       docs/tasks/itinerary/itinerary-map-and-post/02-post-links.md
 *
 * 【初心者向け】DB の行（snake_case、埋め込み）を画面が使う形（camelCase）に整形する。
 *   - listItineraries: 自分がメンバーのしおりを、スポット数・済み件数つきで（`?spot=` があれば「入っているか」も）
 *   - getItinerary  : 詳細。Day 別に並べたスポット（時刻順→手動順）、メンバー、同じ旅行のアルバム投稿数、
 *                     「投稿済み」（自分がこの旅行でそのスポットに投稿したか）、スポットの星平均・費用目安
 * 非メンバーには null を返し、Route Handler が 404 にする（存在も知らせない。3.11.7）。
 */
export interface ItineraryListItem {
  id: string;
  tripId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  dayCount: number;
  spotCount: number;
  checkedCount: number;
  updatedAt: string;
  role: ItineraryRole;
  /** 同じ旅行に投稿（アルバム）があるか */
  hasAlbumPosts: boolean;
  /** `?spot=` 指定時: そのスポットが入っているか（Day も） */
  containsSpot?: boolean;
  spotDayIndex?: number | null;
}

export interface ItinerarySpotItem {
  /** itinerary_spots.id */
  id: string;
  spotId: string;
  name: string;
  prefecture: string | null;
  lat: number;
  lng: number;
  isManualSpot: boolean;
  dayIndex: number | null;
  /** "HH:MM" */
  arrivalTime: string | null;
  sortOrder: number;
  memo: string | null;
  checkedAt: string | null;
  checkedBy: string | null;
  /** 自分がこの旅行でこのスポットに投稿済みか */
  hasPosted: boolean;
  ratingAverage: number | null;
  /** 公開投稿の費用の平均（予算目安） */
  postCount: number;
}

export interface ItineraryMember {
  userId: string;
  displayName: string;
  avatarUrl: string;
  role: ItineraryRole;
  joinedAt: string;
}

export interface ItineraryDetail {
  id: string;
  tripId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  dayCount: number;
  /** Day n（1 始まり）の日付。期間が無ければ空配列 */
  dayDates: string[];
  role: ItineraryRole;
  spots: ItinerarySpotItem[];
  members: ItineraryMember[];
  albumPostCount: number;
  /** 費用目安の合計（費用のあるスポットだけ） */
  updatedAt: string;
}

interface ItineraryRow {
  id: string;
  trip_id: string;
  start_date: string | null;
  end_date: string | null;
  updated_at: string;
  trips: { title: string } | { title: string }[] | null;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function listItineraries(admin: SupabaseClient, userId: string, options: { spotId?: string | null } = {}): Promise<ItineraryListItem[]> {
  const { data: memberships, error } = await admin
    .from("itinerary_members")
    .select("role, itineraries!inner(id, trip_id, start_date, end_date, updated_at, trips(title))")
    .eq("user_id", userId);
  if (error) throw error;

  const rows = (memberships ?? []) as unknown as { role: string; itineraries: ItineraryRow | ItineraryRow[] | null }[];
  const itineraries = rows
    .map((row) => ({ role: row.role as ItineraryRole, itinerary: one(row.itineraries) }))
    .filter((row): row is { role: ItineraryRole; itinerary: ItineraryRow } => row.itinerary !== null);
  if (itineraries.length === 0) return [];

  const ids = itineraries.map((row) => row.itinerary.id);
  const tripIds = itineraries.map((row) => row.itinerary.trip_id);
  const [spotsResult, postsResult] = await Promise.all([
    admin.from("itinerary_spots").select("itinerary_id, spot_id, day_index, checked_at").in("itinerary_id", ids),
    admin.from("posts").select("trip_id").in("trip_id", tripIds).eq("status", "published").is("hidden_at", null),
  ]);
  if (spotsResult.error) throw spotsResult.error;
  if (postsResult.error) throw postsResult.error;

  const spotRows = (spotsResult.data ?? []) as { itinerary_id: string; spot_id: string; day_index: number | null; checked_at: string | null }[];
  const tripsWithPosts = new Set(((postsResult.data ?? []) as { trip_id: string }[]).map((row) => row.trip_id));

  return itineraries.map(({ role, itinerary }) => {
    const spots = spotRows.filter((row) => row.itinerary_id === itinerary.id);
    const target = options.spotId ? spots.find((row) => row.spot_id === options.spotId) : undefined;
    return {
      id: itinerary.id,
      tripId: itinerary.trip_id,
      title: one(itinerary.trips)?.title ?? "",
      startDate: itinerary.start_date,
      endDate: itinerary.end_date,
      dayCount: dayCount(itinerary.start_date, itinerary.end_date),
      spotCount: spots.length,
      checkedCount: spots.filter((row) => row.checked_at !== null).length,
      updatedAt: itinerary.updated_at,
      role,
      hasAlbumPosts: tripsWithPosts.has(itinerary.trip_id),
      ...(options.spotId ? { containsSpot: target !== undefined, spotDayIndex: target?.day_index ?? null } : {}),
    };
  });
}

export async function getItinerary(admin: SupabaseClient, itineraryId: string, userId: string): Promise<ItineraryDetail | null> {
  const role = await getItineraryRole(admin, itineraryId, userId);
  if (!role) return null;

  const { data: row, error } = await admin
    .from("itineraries")
    .select("id, trip_id, start_date, end_date, updated_at, trips(title)")
    .eq("id", itineraryId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const itinerary = row as unknown as ItineraryRow;

  const [spotsResult, membersResult, albumResult, ownPostsResult] = await Promise.all([
    admin
      .from("itinerary_spots")
      .select("id, spot_id, day_index, arrival_time, sort_order, memo, checked_at, checked_by, spots(id, name, prefecture, lat, lng, source)")
      .eq("itinerary_id", itineraryId),
    admin.from("itinerary_members").select("user_id, role, joined_at, users(display_name, avatar_url, is_deleted)").eq("itinerary_id", itineraryId),
    admin.from("posts").select("id", { count: "exact", head: true }).eq("trip_id", itinerary.trip_id).eq("status", "published").is("hidden_at", null),
    admin.from("posts").select("spot_id").eq("trip_id", itinerary.trip_id).eq("user_id", userId).eq("status", "published"),
  ]);
  if (spotsResult.error) throw spotsResult.error;
  if (membersResult.error) throw membersResult.error;

  type SpotRow = {
    id: string;
    spot_id: string;
    day_index: number | null;
    arrival_time: string | null;
    sort_order: number;
    memo: string | null;
    checked_at: string | null;
    checked_by: string | null;
    spots: { id: string; name: string; prefecture: string | null; lat: number; lng: number; source: string } | null | { id: string; name: string; prefecture: string | null; lat: number; lng: number; source: string }[];
  };
  const spotRows = (spotsResult.data ?? []) as unknown as SpotRow[];
  const spotIds = Array.from(new Set(spotRows.map((row) => row.spot_id)));
  const stats = await findSpotStats(admin, spotIds);
  const postedSpotIds = new Set(((ownPostsResult.data ?? []) as { spot_id: string }[]).map((row) => row.spot_id));

  const spots = orderSpots(
    spotRows.flatMap((row) => {
      const spot = one(row.spots);
      if (!spot) return [];
      const stat = stats.get(spot.id);
      return [
        {
          id: row.id,
          spotId: spot.id,
          name: spot.name,
          prefecture: spot.prefecture,
          lat: spot.lat,
          lng: spot.lng,
          isManualSpot: spot.source === "manual",
          dayIndex: row.day_index,
          arrivalTime: toHHMM(row.arrival_time),
          sortOrder: row.sort_order,
          memo: row.memo,
          checkedAt: row.checked_at,
          checkedBy: row.checked_by,
          hasPosted: postedSpotIds.has(spot.id),
          ratingAverage: stat?.ratingAverage ?? null,
          postCount: stat?.postCount ?? 0,
        },
      ];
    })
  );

  const members: ItineraryMember[] = ((membersResult.data ?? []) as unknown as {
    user_id: string;
    role: string;
    joined_at: string;
    users: { display_name: string | null; avatar_url: string | null; is_deleted: boolean } | { display_name: string | null; avatar_url: string | null; is_deleted: boolean }[] | null;
  }[]).map((row) => {
    const user = one(row.users);
    return {
      userId: row.user_id,
      displayName: user?.is_deleted ? DEACTIVATED_DISPLAY_NAME : (user?.display_name ?? "ユーザー"),
      avatarUrl: user?.avatar_url ?? DEFAULT_AVATAR_URL,
      role: row.role as ItineraryRole,
      joinedAt: row.joined_at,
    };
  });

  const count = dayCount(itinerary.start_date, itinerary.end_date);
  return {
    id: itinerary.id,
    tripId: itinerary.trip_id,
    title: one(itinerary.trips)?.title ?? "",
    startDate: itinerary.start_date,
    endDate: itinerary.end_date,
    dayCount: count,
    dayDates: Array.from({ length: count }, (_, i) => dayDate(itinerary.start_date, i + 1) as string),
    role,
    spots,
    members,
    albumPostCount: albumResult.count ?? 0,
    updatedAt: itinerary.updated_at,
  };
}

/** スポットごとの公開投稿の件数・星平均（費用は v3.1 で表示しなくなったので取らない） */
async function findSpotStats(
  admin: SupabaseClient,
  spotIds: string[]
): Promise<Map<string, { postCount: number; ratingAverage: number | null }>> {
  const map = new Map<string, { postCount: number; ratingAverage: number | null }>();
  if (spotIds.length === 0) return map;
  const { data, error } = await admin
    .from("posts")
    .select("spot_id, rating")
    .in("spot_id", spotIds)
    .eq("visibility", "public")
    .eq("status", "published")
    .is("hidden_at", null);
  if (error) throw error;
  const groups = new Map<string, { ratings: number[]; count: number }>();
  for (const row of (data ?? []) as { spot_id: string; rating: number | null }[]) {
    const group = groups.get(row.spot_id) ?? { ratings: [], count: 0 };
    group.count += 1;
    if (typeof row.rating === "number") group.ratings.push(row.rating);
    groups.set(row.spot_id, group);
  }
  const avg = (values: number[]) => (values.length === 0 ? null : Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10);
  for (const [spotId, group] of groups) {
    map.set(spotId, { postCount: group.count, ratingAverage: avg(group.ratings) });
  }
  return map;
}
