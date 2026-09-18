/**
 * post-timeline Task1: 徒歩分の計算
 * 出典: docs/tasks/map-search/post-timeline/01-search-api-destination.md
 *       要件定義書 v3.0 3.4.2（「徒歩 N 分」は現在地があるときだけ）
 *
 * 【初心者向け】「徒歩 N 分」は不動産広告と同じ基準（80m ＝ 1 分）で、直線距離を 80 で割って切り上げる。
 * 直線距離は Haversine（球面上の 2 点間距離）の公式で求める。道なりの距離ではないので目安に過ぎない。
 */
export const WALK_METERS_PER_MINUTE = 80;

/** 距離（m）→ 徒歩分。0m でも「徒歩 1 分」にする（0 分は変なので） */
export function walkMinutes(distanceMeters: number): number {
  return Math.max(1, Math.ceil(distanceMeters / WALK_METERS_PER_MINUTE));
}

/** 2 点間の直線距離（m）。地球を半径 6371km の球とみなす */
export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** 現在地からスポットまでの徒歩分。どちらかが無ければ null */
export function walkMinutesBetween(
  viewer: { lat: number; lng: number } | null | undefined,
  spot: { lat: number | null; lng: number | null }
): number | null {
  if (!viewer || spot.lat === null || spot.lng === null) return null;
  return walkMinutes(haversineMeters(viewer, { lat: spot.lat, lng: spot.lng }));
}
