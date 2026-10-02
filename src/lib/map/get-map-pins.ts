import type { SupabaseClient } from "@supabase/supabase-js";
import { getBlockedUserIds } from "@/lib/blocks/get-blocked-user-ids";
import {
  aggregateSpot,
  EMPTY_SPOT_FILTERS,
  hasActiveSpotFilters,
  matchesSpotFilters,
  averageRating,
  type SpotAggregate,
  type SpotFilters,
} from "./spot-aggregate";
import type { PostCategory } from "@/lib/posts/constants";
import { findLatestSpotStatuses } from "@/lib/posts/post-cards";
import { UNNAMED_SPOT_NAME } from "@/lib/spots/finalize-spot";
import type { LatestSpotStatus } from "@/lib/spots/format-status-label";

/** 表示中の地図範囲内で読み込むピンの上限（要件定義書3.4.1） */
export const MAX_MAP_PINS = 100;

/** 地図の表示範囲（緯度経度の矩形） */
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * map-display-v3 Task1: ピンの種別
 *   post : 公開投稿があるスポット（青）
 *   saved: 自分の「行きたい」または自分がメンバーのしおりに入っているスポット（赤。post より優先）
 *   draft: 自分の下書き（灰の破線。本人にだけ返す）
 */
export type MapPinKind = "post" | "saved" | "draft";

/** 地図に置く1本のピン（吹き出し用の情報も持つ） */
export interface MapPinData {
  /** ピンの識別子。スポットは spotId、下書きは `draft:<postId>` */
  id: string;
  kind: MapPinKind;
  /** 下書きでスポット未確定なら null */
  spotId: string | null;
  name: string;
  lat: number;
  lng: number;
  prefecture: string | null;
  /** 公開投稿の件数（下書きは 0） */
  postCount: number;
  /** 星評価の平均（小数 1 桁）。投稿が無ければ null */
  ratingAverage: number | null;
  /** pin-categories Task2: ピンの色と記号を決めるカテゴリ（公開投稿から決める。無ければ null） */
  category: PostCategory | null;
  /** 最新の「まだあった」報告（spot-status-report Task3） */
  latestStatus: LatestSpotStatus | null;
  /** kind = draft のとき、下書きの投稿 ID（「続きを書く」→ /posts/new?draft=） */
  draftId: string | null;
}

interface SpotRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  prefecture: string | null;
  /** explore-mode Task 4: 「タビコエだけの場所」か（spots.source = manual） */
  source?: string | null;
}

export interface SpotWithPostsRow extends SpotRow {
  posts: {
    user_id: string;
    visibility: string;
    rating: number | null;
    category?: string | null;
    created_at?: string | null;
    /* explore-mode Task 4（2026-10-02）: 代表値（予算の平均・滞在時間）を出すために足した */
    cost?: number | null;
    duration?: string | null;
  }[];
  /** explore-mode Task 4: 「タビコエだけの場所」か（spots.source = manual） */
  source?: string | null;
}

export interface DraftRow {
  id: string;
  lat: number;
  lng: number;
  spot: SpotRow | null;
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

/** 星平均（小数 1 桁）。評価が 1 件も無ければ null */
// 2026-10-02: 平均の計算は spot-aggregate.ts に移した（代表値の計算を 1 か所に集めるため。約束 14）。
// 既にここから読んでいる所があるので、名前はそのまま通す
export { averageRating };

/**
 * map-display-v3 Task1: 3 系統（投稿・保存済み・下書き）を 1 つの配列にまとめる（単体テストの対象）
 *
 * 【初心者向け】ルール:
 *   - 同じスポットが「投稿あり」と「保存済み」の両方に該当したら、赤（saved）1 本にする（受入条件: 赤が優先）
 *   - 投稿の集計（件数・星平均）は saved になっても付ける（吹き出しに出す）
 *   - 下書きはスポットとは別のピン（同じ場所に投稿ピンがあっても両方出す。自分にしか見えない）
 *   - 最大 100 件。保存済み → 投稿 → 下書きの順に詰める（保存済みは数が少なく、本人にとって大事なため）
 */
export function mergeMapPins(
  postSpots: SpotWithPostsRow[],
  savedSpots: SpotRow[],
  drafts: DraftRow[],
  latestStatusBySpot: ReadonlyMap<string, LatestSpotStatus> = new Map(),
  limit: number = MAX_MAP_PINS,
  /*
   * explore-mode Task 4（2026-10-02）: 探すモードの絞り込み。
   *
   * 【初心者向け】**投稿を 1 件ずつ落とすのではなく、スポットごと落とす**。
   * 地図が探しているのは場所なので、代表値（spot-aggregate.ts）が条件に合うかで決める。
   * こうすると、残ったスポットの件数・評価・色は**そのスポットの全公開投稿**から出た値のままになる。
   */
  filters: SpotFilters = EMPTY_SPOT_FILTERS
): MapPinData[] {
  const active = hasActiveSpotFilters(filters);
  const stats = new Map<string, SpotAggregate>();
  for (const row of postSpots) {
    const publicPosts = row.posts.filter((post) => post.visibility === "public");
    if (publicPosts.length === 0) continue;
    const aggregate = aggregateSpot(
      publicPosts.map((post) => ({
        category: post.category ?? null,
        duration: post.duration ?? null,
        cost: post.cost ?? null,
        rating: post.rating,
        createdAt: post.created_at ?? null,
      }))
    );
    // 条件に合わないスポットは、ピンそのものを出さない
    if (active && !matchesSpotFilters(aggregate, { manual: row.source === "manual" }, filters)) continue;
    stats.set(row.id, aggregate);
  }

  const pins: MapPinData[] = [];
  const seen = new Set<string>();
  const pushSpot = (spot: SpotRow, kind: "post" | "saved") => {
    if (seen.has(spot.id) || pins.length >= limit) return;
    seen.add(spot.id);
    const stat = stats.get(spot.id);
    pins.push({
      id: spot.id,
      kind,
      spotId: spot.id,
      name: spot.name,
      lat: spot.lat,
      lng: spot.lng,
      prefecture: spot.prefecture,
      postCount: stat?.postCount ?? 0,
      ratingAverage: stat?.ratingAverage ?? null,
      category: stat?.category ?? null,
      latestStatus: latestStatusBySpot.get(spot.id) ?? null,
      draftId: null,
    });
  };

  /*
   * explore-mode Task 4（2026-10-02）: 絞り込みが効いているときは、
   * **条件に合うスポットだけ**を出す。
   *
   * 【初心者向け】保存済み（行きたい）と下書きは、投稿とは別の理由で出しているピン。
   * ただし絞り込み中にそれらが残ると、**条件に合わないピンが地図に出たまま**になり、
   * 「絞り込んだのに出ている」と壊れて見える。探している最中は、探しているものだけ出す。
   */
  for (const spot of savedSpots) {
    if (active && !stats.has(spot.id)) continue;
    pushSpot(spot, "saved");
  }
  for (const spot of postSpots) if (stats.has(spot.id)) pushSpot(spot, "post");
  for (const draft of drafts) {
    if (active) break;
    if (pins.length >= limit) break;
    const id = `draft:${draft.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    pins.push({
      id,
      kind: "draft",
      // 下書きはまだカテゴリが決まっていない（灰色の破線のピンになる）
      category: null,
      spotId: draft.spot?.id ?? null,
      name: draft.spot?.name ?? UNNAMED_SPOT_NAME,
      lat: draft.lat,
      lng: draft.lng,
      prefecture: draft.spot?.prefecture ?? null,
      postCount: 0,
      ratingAverage: null,
      latestStatus: null,
      draftId: draft.id,
    });
  }
  return pins;
}

// 矩形の絞り込みを 4 回書かずに済ませる小さな道具。PostgREST の型が深くなりすぎるので any で受ける
function inBounds<Q>(query: Q, prefix: string, bounds: MapBounds): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = query as any;
  return q.gte(`${prefix}lat`, bounds.south).lte(`${prefix}lat`, bounds.north).gte(`${prefix}lng`, bounds.west).lte(`${prefix}lng`, bounds.east) as Q;
}

/**
 * map-display-v3 Task1: 表示範囲内のピン（投稿・保存済み・下書き）を 1 回で返す。
 * ブロック関係のユーザーの投稿しか無いスポットは、相互非表示（3.8.2）のため投稿ピンにしない。
 *
 * 【初心者向け】DB へは 4 本の問い合わせを同時（Promise.all）に投げ、mergeMapPins で合体する。
 *   1. 公開投稿があるスポット（spots に posts を inner join）
 *   2. 自分の「行きたい」（wishlist → spots）
 *   3. 自分がメンバーのしおりのスポット（itinerary_spots → spots。しおりの絞り込みは itinerary_members で）
 *   4. 自分の下書き（posts.status = draft、lat/lng あり）
 */
export async function getMapPins(admin: SupabaseClient, userId: string, bounds: MapBounds): Promise<MapPinData[]> {
  const blockedIds = await getBlockedUserIds(admin, userId);

  let postQuery = inBounds(
    admin
      .from("spots")
      .select("id, name, lat, lng, prefecture, posts!inner(user_id, visibility, rating, category, created_at)")
      .eq("posts.visibility", "public")
      .eq("posts.status", "published")
      // F-AD-05: 非公開化された投稿・スポットは除く
      .is("posts.hidden_at", null)
      .is("hidden_at", null),
    "",
    bounds
  ).limit(MAX_MAP_PINS);
  if (blockedIds.length > 0) {
    postQuery = postQuery.not("posts.user_id", "in", `(${blockedIds.join(",")})`);
  }

  const wishlistQuery = inBounds(
    admin.from("wishlist").select("spot:spots!inner(id, name, lat, lng, prefecture)").eq("user_id", userId).is("spots.hidden_at", null),
    "spots.",
    bounds
  ).limit(MAX_MAP_PINS);

  const { data: memberships } = await admin.from("itinerary_members").select("itinerary_id").eq("user_id", userId);
  const itineraryIds = (memberships ?? []).map((row) => row.itinerary_id as string);
  const itineraryQuery =
    itineraryIds.length > 0
      ? inBounds(
          admin
            .from("itinerary_spots")
            .select("spot:spots!inner(id, name, lat, lng, prefecture)")
            .in("itinerary_id", itineraryIds)
            .is("spots.hidden_at", null),
          "spots.",
          bounds
        ).limit(MAX_MAP_PINS)
      : Promise.resolve({ data: [], error: null });

  const draftQuery = inBounds(
    admin
      .from("posts")
      .select("id, lat, lng, spot:spots(id, name, lat, lng, prefecture)")
      .eq("user_id", userId)
      .eq("status", "draft")
      .not("lat", "is", null)
      .not("lng", "is", null),
    "",
    bounds
  ).limit(MAX_MAP_PINS);

  const [postResult, wishlistResult, itineraryResult, draftResult] = await Promise.all([postQuery, wishlistQuery, itineraryQuery, draftQuery]);
  for (const result of [postResult, wishlistResult, itineraryResult, draftResult]) {
    if (result.error) throw result.error;
  }

  const postSpots = (postResult.data ?? []) as unknown as SpotWithPostsRow[];
  const savedSpots = [...((wishlistResult.data ?? []) as unknown as { spot: SpotRow | SpotRow[] | null }[]), ...((itineraryResult.data ?? []) as unknown as { spot: SpotRow | SpotRow[] | null }[])]
    .map((row) => one(row.spot))
    .filter((spot): spot is SpotRow => spot !== null);
  const drafts = ((draftResult.data ?? []) as unknown as { id: string; lat: number; lng: number; spot: SpotRow | SpotRow[] | null }[]).map((row) => ({
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    spot: one(row.spot),
  }));

  const spotIds = Array.from(new Set([...postSpots.map((row) => row.id), ...savedSpots.map((spot) => spot.id)]));
  const latestStatusBySpot = await findLatestSpotStatuses(admin, spotIds);
  return mergeMapPins(postSpots, savedSpots, drafts, latestStatusBySpot);
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
