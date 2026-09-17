import type { SupabaseClient } from "@supabase/supabase-js";
import { DUPLICATE_SPOT_RADIUS_METERS, findNearbySpots, type NearbySpot } from "./nearby";

/**
 * spot-selection-v3 Task2: 位置からスポットを解決する
 * 出典: docs/tasks/posts/spot-selection-v3/02-resolve-spot-by-location.md
 *
 * 【初心者向け】SC-03 の地図を動かすたびに「この位置の近く（50m）に登録済みスポットがあるか」を調べ、
 * あればスポット名欄に自動で入れる。無ければ null（＝「この場所（新しい場所）」）。
 * 最も近い 1 件だけを返す。
 */
export async function resolveSpotByLocation(admin: SupabaseClient, lat: number, lng: number): Promise<NearbySpot | null> {
  const nearby = await findNearbySpots(admin, lat, lng, DUPLICATE_SPOT_RADIUS_METERS);
  if (nearby.length === 0) return null;
  return nearby.reduce((closest, spot) => (spot.distance_meters < closest.distance_meters ? spot : closest));
}

/** クエリ文字列の lat/lng を数値にする。範囲外・非数は null */
export function parseLatLng(searchParams: URLSearchParams): { lat: number; lng: number } | null {
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
