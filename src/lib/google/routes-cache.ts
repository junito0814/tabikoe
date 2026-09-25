import { fetchTravelMinutes, isRoutesApiMode, type LatLng } from "./routes";
import type { TravelMode } from "@/lib/geo/travel-time";

/**
 * travel-time Task1（2026-09-25）: Routes API の結果を短時間だけ使い回す
 * 出典: docs/tasks/map-search/travel-time/01-routes-api-client.md、要件定義書 6.6・6.7
 *
 * 【初心者向け】Routes API は 1 回で最大 20 件を消費する。同じ場所で地図を少し動かすたびに呼ぶと
 * 費用がかさむので、現在地を約 100m 単位に丸めた値＋移動手段＋目的地の並びをキーにして 10 分だけ覚えておく。
 * サーバーのメモリに置くだけなので、再起動で消えてよい（消えても正しく動く）。
 */
export const ROUTES_CACHE_TTL_MS = 10 * 60 * 1000;
/** 現在地を丸める細かさ（度）。緯度 0.001 度 ≒ 111m */
export const ORIGIN_GRID_DEGREES = 0.001;

/** 現在地を約 100m 単位に丸める（純粋関数） */
export function roundOrigin(origin: LatLng): LatLng {
  const round = (value: number) => Math.round(value / ORIGIN_GRID_DEGREES) * ORIGIN_GRID_DEGREES;
  return { lat: Number(round(origin.lat).toFixed(3)), lng: Number(round(origin.lng).toFixed(3)) };
}

/** キャッシュの鍵。丸めた現在地・移動手段・目的地の並びで決まる（純粋関数） */
export function cacheKey(origin: LatLng, destinations: LatLng[], mode: TravelMode): string {
  const rounded = roundOrigin(origin);
  const points = destinations.map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join("|");
  return `${mode}@${rounded.lat},${rounded.lng}#${points}`;
}

const cache = new Map<string, { minutes: (number | null)[]; storedAt: number }>();

/** 単体テスト用: 覚えている内容を消す */
export function clearRoutesCache(): void {
  cache.clear();
}

export type FetchMinutes = typeof fetchTravelMinutes;

/**
 * 所要時間（分）を目的地の順に返す。徒歩・自転車は Routes API を呼ばず全部 null。
 * 10 分以内に同じ鍵で聞かれていれば、その結果をそのまま返す。
 */
export async function getTravelMinutes(
  origin: LatLng,
  destinations: LatLng[],
  mode: TravelMode,
  now: number = Date.now(),
  fetcher: FetchMinutes = fetchTravelMinutes
): Promise<(number | null)[]> {
  if (!isRoutesApiMode(mode) || destinations.length === 0) return destinations.map(() => null);

  const key = cacheKey(origin, destinations, mode);
  const hit = cache.get(key);
  if (hit && now - hit.storedAt < ROUTES_CACHE_TTL_MS) return hit.minutes;

  const minutes = await fetcher(roundOrigin(origin), destinations, mode, new Date(now));
  // 1 件も取れなかったときは覚えない（次の機会にもう一度試す）
  if (minutes.some((value) => value !== null)) cache.set(key, { minutes, storedAt: now });
  return minutes;
}
