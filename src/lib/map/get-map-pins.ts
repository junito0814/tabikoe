import type { SupabaseClient } from "@supabase/supabase-js";
import { getBlockedUserIds } from "@/lib/blocks/get-blocked-user-ids";

/** 表示中の地図範囲内で読み込むピンの上限（要件定義書3.4.1） */
export const MAX_MAP_PINS = 100;

export type MapView = "all" | "wishlist";

/** 地図の表示範囲（緯度経度の矩形） */
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** 地図に置く1本のピン。種別（normal/wishlist）の決定は画面側（resolveMapPinType）が行う */
export interface MapPinData {
  spotId: string;
  name: string;
  lat: number;
  lng: number;
  prefecture: string | null;
  /** 公開投稿の件数。「行きたい」タブでは集計しない（0） */
  postCount: number;
  /** ログインユーザー自身の投稿（公開・非公開を問わず）があるスポットか */
  hasOwnPost: boolean;
  /** ログインユーザーが「行きたい」保存しているスポットか */
  isWishlisted: boolean;
}

interface SpotRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  prefecture: string | null;
}

interface SpotWithPostsRow extends SpotRow {
  posts: { user_id: string; visibility: string }[];
}

/**
 * F-MP-01 Task1: クエリから地図範囲を読む。4辺すべてが有限の数値で、南北・東西が逆でなければ受理する
 */
export function parseMapBounds(searchParams: URLSearchParams): MapBounds | null {
  const values = (["north", "south", "east", "west"] as const).map((key) => {
    const raw = searchParams.get(key);
    return raw === null || raw.trim() === "" ? NaN : Number(raw);
  });
  if (values.some((value) => !Number.isFinite(value))) {
    return null;
  }
  const [north, south, east, west] = values;
  if (north < south || east < west) return null;
  if (north > 90 || south < -90 || east > 180 || west < -180) return null;
  return { north, south, east, west };
}

/** 同じ矩形か（idle の重複発火で無駄な再取得をしないための比較） */
export function isSameBounds(a: MapBounds, b: MapBounds): boolean {
  return a.north === b.north && a.south === b.south && a.east === b.east && a.west === b.west;
}

export function parseMapView(value: string | null): MapView {
  return value === "wishlist" ? "wishlist" : "all";
}

/**
 * F-MP-01 Task1: 「全体」タブ用の集約
 *
 * 同一スポットへの複数投稿を1件のピンにまとめ、公開投稿が1件も無いスポットは除外し、
 * 最大件数で打ち切る。Route Handlerが DB から取った行（スポット＋紐づく投稿）を受け取る純粋関数。
 * 単体テストの対象。
 */
export function aggregateSpotPins(
  rows: SpotWithPostsRow[],
  userId: string,
  wishlistedSpotIds: ReadonlySet<string>,
  limit: number = MAX_MAP_PINS
): MapPinData[] {
  const pins: MapPinData[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    const publicPosts = row.posts.filter((post) => post.visibility === "public");
    if (publicPosts.length === 0) continue;
    seen.add(row.id);

    pins.push({
      spotId: row.id,
      name: row.name,
      lat: row.lat,
      lng: row.lng,
      prefecture: row.prefecture,
      postCount: publicPosts.length,
      hasOwnPost: row.posts.some((post) => post.user_id === userId),
      isWishlisted: wishlistedSpotIds.has(row.id),
    });

    if (pins.length >= limit) break;
  }

  return pins;
}

/**
 * F-MP-01 Task2: 「行きたい」タブ用の絞り込み
 *
 * ログインユーザー自身の保存分だけを対象にする。他ユーザーの保存行が混ざって渡されても落とす。
 * 単体テストの対象。
 */
export function selectOwnWishlistPins(
  rows: { user_id: string; spot: SpotRow | null }[],
  userId: string,
  ownPostSpotIds: ReadonlySet<string>,
  limit: number = MAX_MAP_PINS
): MapPinData[] {
  const pins: MapPinData[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.user_id !== userId || !row.spot || seen.has(row.spot.id)) continue;
    seen.add(row.spot.id);
    pins.push({
      spotId: row.spot.id,
      name: row.spot.name,
      lat: row.spot.lat,
      lng: row.spot.lng,
      prefecture: row.spot.prefecture,
      postCount: 0,
      hasOwnPost: ownPostSpotIds.has(row.spot.id),
      isWishlisted: true,
    });
    if (pins.length >= limit) break;
  }

  return pins;
}

/**
 * 「全体」タブ: 範囲内で公開投稿が1件以上あるスポット（最大100件）。
 * ブロック関係のユーザーの投稿しか無いスポットは、相互非表示（3.8.2）のため除外する。
 *
 * spots に posts を inner join し、visibility=public で埋め込み側を絞る。
 * inner join なので、条件に合う投稿が残らないスポットは結果から落ちる。
 */
export async function getAllTabPins(
  admin: SupabaseClient,
  userId: string,
  bounds: MapBounds
): Promise<MapPinData[]> {
  const blockedIds = await getBlockedUserIds(admin, userId);

  let query = admin
    .from("spots")
    .select("id, name, lat, lng, prefecture, posts!inner(user_id, visibility)")
    .eq("posts.visibility", "public")
    // F-AD-05: 非公開化された投稿・スポットは除く
    .is("posts.hidden_at", null)
    .is("hidden_at", null)
    .gte("lat", bounds.south)
    .lte("lat", bounds.north)
    .gte("lng", bounds.west)
    .lte("lng", bounds.east)
    .limit(MAX_MAP_PINS);
  if (blockedIds.length > 0) {
    query = query.not("posts.user_id", "in", `(${blockedIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as SpotWithPostsRow[];
  const spotIds = rows.map((row) => row.id);
  const [wishlisted, ownPostSpotIds] = await Promise.all([
    findWishlistedSpotIds(admin, userId, spotIds),
    findOwnPostSpotIds(admin, userId, spotIds),
  ]);

  // 埋め込みは公開投稿だけなので、自分の非公開投稿があるスポットは別途 hasOwnPost を立てる
  return aggregateSpotPins(rows, userId, wishlisted).map((pin) => ({
    ...pin,
    hasOwnPost: pin.hasOwnPost || ownPostSpotIds.has(pin.spotId),
  }));
}

/** 「行きたい」タブ: ログインユーザー自身が保存した、範囲内のスポット（最大100件） */
export async function getWishlistTabPins(
  admin: SupabaseClient,
  userId: string,
  bounds: MapBounds
): Promise<MapPinData[]> {
  const { data, error } = await admin
    .from("wishlist")
    .select("user_id, spot:spots!inner(id, name, lat, lng, prefecture)")
    .eq("user_id", userId)
    .is("spots.hidden_at", null)
    .gte("spots.lat", bounds.south)
    .lte("spots.lat", bounds.north)
    .gte("spots.lng", bounds.west)
    .lte("spots.lng", bounds.east)
    .order("created_at", { ascending: false })
    .limit(MAX_MAP_PINS);
  if (error) throw error;

  const rows = (data ?? []) as unknown as { user_id: string; spot: SpotRow | null }[];
  const spotIds = rows.flatMap((row) => (row.spot ? [row.spot.id] : []));
  const ownPostSpotIds = await findOwnPostSpotIds(admin, userId, spotIds);

  return selectOwnWishlistPins(rows, userId, ownPostSpotIds);
}

async function findWishlistedSpotIds(
  admin: SupabaseClient,
  userId: string,
  spotIds: string[]
): Promise<Set<string>> {
  if (spotIds.length === 0) return new Set();
  const { data, error } = await admin
    .from("wishlist")
    .select("spot_id")
    .eq("user_id", userId)
    .in("spot_id", spotIds);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.spot_id as string));
}

async function findOwnPostSpotIds(
  admin: SupabaseClient,
  userId: string,
  spotIds: string[]
): Promise<Set<string>> {
  if (spotIds.length === 0) return new Set();
  const { data, error } = await admin
    .from("posts")
    .select("spot_id")
    .eq("user_id", userId)
    .in("spot_id", spotIds);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.spot_id as string));
}
