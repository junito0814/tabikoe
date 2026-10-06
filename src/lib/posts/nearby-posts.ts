import type { SupabaseClient } from "@supabase/supabase-js";
import { getBlockedUserIds } from "@/lib/blocks/get-blocked-user-ids";
import { haversineMeters, walkMinutes } from "@/lib/geo/walk-minutes";
import { getTravelMinutes } from "@/lib/google/routes-cache";
import { travelMinutes, TRAVEL_RADIUS_METERS, type TravelMode } from "@/lib/geo/travel-time";
import { createPostPhotoUrls } from "@/lib/posts/signed-url";
import { boundsAround } from "@/lib/posts/search-posts";
import { aggregateNearbySpots, type NearbySpot } from "./nearby-spots";

/**
 * explore-mode Task1: 近くの投稿 API のロジック
 * 出典: docs/tasks/browsing/explore-mode/01-nearby-posts-api.md
 *       要件定義書 v3.0 3.4.5（探すモード。徒歩圏 500m／1km／3km、既定 1km、近い順に最大 20 件）
 *
 * 【初心者向け】「近くの声」のカードに必要な最小限（スポット名・感想の冒頭・代表写真・距離・徒歩分）だけを返す。
 * 距離の絞り込みは post-timeline と同じ 2 段階（矩形で DB を絞る → Haversine で円判定）。
 * 並び順は「近い順」。同じスポットに複数の投稿があっても、それぞれ別のカードにする（声を見せる画面なので）。
 */
/** v3.0 の徒歩圏（500m／1km／3km）。v3.2 で「移動手段」（徒歩 1km／自転車 3km／車 10km）に置き換わり、radius= は互換のために残す */
export const NEARBY_RADIUS_OPTIONS = [500, 1000, 3000, 10000] as const;
export type NearbyRadius = (typeof NEARBY_RADIUS_OPTIONS)[number];
export const DEFAULT_NEARBY_RADIUS: NearbyRadius = 1000;
export const NEARBY_POSTS_LIMIT = 20;
/**
 * v3.2: 移動手段 → 半径（m）
 *
 * 【初心者向け】戻り値は `NearbyRadius`（500／1000／3000／10000）ではなく素の number。
 * 電車 15000・バス 8000 はその 4 つに含まれないので、型を偽って通していた（`as NearbyRadius`）。
 * `NearbyRadius` は v3.0 の `radius=` パラメータ（互換用）のためだけに残っている値の集合なので、混ぜない。
 */
export function radiusForTravelMode(mode: TravelMode): number {
  return TRAVEL_RADIUS_METERS[mode];
}
/** 円判定の前に DB から取る上限（矩形の中には円の外も含まれるため多めに） */
export const NEARBY_FETCH_CAP = 200;

export function parseNearbyRadius(value: string | null): NearbyRadius {
  const number = Number(value);
  return (NEARBY_RADIUS_OPTIONS as readonly number[]).includes(number) ? (number as NearbyRadius) : DEFAULT_NEARBY_RADIUS;
}

export interface NearbyPost {
  id: string;
  spotId: string;
  spotName: string;
  commentExcerpt: string | null;
  thumbnailUrl: string | null;
  lat: number;
  lng: number;
  distanceMeters: number;
  /** 徒歩の分（v3.0。互換のため残す） */
  walkMinutes: number;
  /** v3.2: 選んだ移動手段での所要時間の目安（分） */
  minutes: number;
  mode: TravelMode;
}

export interface NearbyPostRow {
  id: string;
  spot_id: string;
  comment: string | null;
  /** #769: スポット単位にまとめるとき、★の平均を出すのに使う */
  rating: number | null;
  spots: { id: string; name: string; lat: number; lng: number } | { id: string; name: string; lat: number; lng: number }[] | null;
  post_photos: { storage_url: string | null; display_order: number; hidden_at?: string | null }[];
}

const EXCERPT_LENGTH = 40;

/** 半径内を近い順に最大 limit 件（単体テストの対象。署名 URL は後で付ける） */
export function selectNearbyPosts(
  rows: NearbyPostRow[],
  center: { lat: number; lng: number },
  radiusMeters: number,
  limit: number = NEARBY_POSTS_LIMIT,
  mode: TravelMode = "walk",
  /*
   * explore-mode Task 4（2026-10-02）: 絞り込みで残ったスポットの id。null は絞り込みなし。
   *
   * 【初心者向け】ここでは代表値の計算をしない。**地図のピン側（`findMatchingSpotIds`）が出した答え**を
   * そのまま使う。カードの取得には上限（`NEARBY_FETCH_CAP`）があり、投稿の多い場所では
   * スポットの投稿を途中までしか取れないので、ここで計算すると**ピンとカードで判定が食い違う**。
   */
  allowedSpotIds: ReadonlySet<string> | null = null
): (Omit<NearbyPost, "thumbnailUrl"> & { thumbnailPath: string | null; rating: number | null })[] {
  return rows
    .flatMap((row) => {
      const spot = Array.isArray(row.spots) ? row.spots[0] : row.spots;
      if (!spot) return [];
      if (allowedSpotIds && !allowedSpotIds.has(spot.id)) return [];
      const distance = haversineMeters(center, spot);
      if (distance > radiusMeters) return [];
      const photo = [...row.post_photos].filter((p) => !p.hidden_at).sort((a, b) => a.display_order - b.display_order)[0];
      return [
        {
          id: row.id,
          spotId: spot.id,
          spotName: spot.name,
          commentExcerpt: row.comment
            ? Array.from(row.comment).slice(0, EXCERPT_LENGTH).join("") + (Array.from(row.comment).length > EXCERPT_LENGTH ? "…" : "")
            : null,
          thumbnailPath: photo?.storage_url ?? null,
          // #769: スポット単位にまとめるときの★の平均に使う
          rating: typeof row.rating === "number" ? row.rating : null,
          lat: spot.lat,
          lng: spot.lng,
          distanceMeters: Math.round(distance),
          walkMinutes: walkMinutes(distance),
          minutes: travelMinutes(distance, mode),
          mode,
        },
      ];
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}

export async function getNearbyPosts(
  admin: SupabaseClient,
  viewerId: string,
  center: { lat: number; lng: number },
  radiusMeters: number,
  mode: TravelMode = "walk",
  options: {
    /** explore-mode Task 4: 絞り込みで残ったスポットの id（`findMatchingSpotIds` の結果）。null は絞り込みなし */
    allowedSpotIds?: ReadonlySet<string> | null;
    /** 差し替え口（単体テスト用）。既定は Routes API＋10 分キャッシュ */
    travelMinutesFetcher?: (origin: { lat: number; lng: number }, destinations: { lat: number; lng: number }[], mode: TravelMode) => Promise<(number | null)[]>;
  } = {}
): Promise<NearbySpot[]> {
  const { allowedSpotIds = null, travelMinutesFetcher = getTravelMinutes } = options;
  const blockedIds = await getBlockedUserIds(admin, viewerId);
  const box = boundsAround(center, radiusMeters);
  let query = admin
    .from("posts")
    // #769: スポット単位にまとめるので rating も読む
    .select("id, spot_id, comment, rating, spots!inner(id, name, lat, lng), post_photos(storage_url, display_order, hidden_at)")
    .eq("visibility", "public")
    .eq("status", "published")
    .is("hidden_at", null)
    .is("spots.hidden_at", null)
    .gte("spots.lat", box.south)
    .lte("spots.lat", box.north)
    .gte("spots.lng", box.west)
    .lte("spots.lng", box.east)
    .order("created_at", { ascending: false })
    .limit(NEARBY_FETCH_CAP);
  if (blockedIds.length > 0) query = query.not("user_id", "in", `(${blockedIds.join(",")})`);
  const { data, error } = await query;
  if (error) throw error;

  /*
   * #769（2026-10-06）: **件数を絞る前に**スポットごとにまとめる。
   *
   * 【初心者向け】以前は投稿を 20 件に絞ってから返していました。浅草寺に 3 件あると
   * **その 3 件で 20 のうち 3 枠を使う**ので、カードが「浅草寺・浅草寺・浅草寺…」と並び、
   * 近くに何か所あるのかが分かりませんでした。先にまとめてから**スポットを 20 件**に絞ります。
   */
  const posts = selectNearbyPosts((data ?? []) as unknown as NearbyPostRow[], center, radiusMeters, NEARBY_FETCH_CAP, mode, allowedSpotIds);
  const selected = aggregateNearbySpots(posts, NEARBY_POSTS_LIMIT);

  // travel-time Task2（2026-09-25）: 車・電車・バスは Routes API の実測に差し替える。
  // 取れなかった分（経路なし・API 障害）は selectNearbyPosts が入れた直線距離の計算のまま残す
  const [signed, apiMinutes] = await Promise.all([
    createPostPhotoUrls(admin, selected.flatMap((spot) => (spot.thumbnailPath ? [spot.thumbnailPath] : []))),
    travelMinutesFetcher(center, selected.map((spot) => ({ lat: spot.lat, lng: spot.lng })), mode),
  ]);
  return selected.map(({ thumbnailPath, ...spot }, index) => ({
    ...spot,
    minutes: apiMinutes[index] ?? spot.minutes,
    thumbnailUrl: thumbnailPath ? (signed.get(thumbnailPath) ?? null) : null,
  }));
}
