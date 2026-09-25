import type { TravelMode } from "@/lib/geo/travel-time";

/**
 * travel-time Task1（2026-09-25）: Routes API で車・電車・バスの所要時間を実測する
 * 出典: docs/tasks/map-search/travel-time/01-routes-api-client.md
 *       要件定義書 6.7「Google Routes API」
 *
 * 【初心者向け】`computeRouteMatrix` は「出発地 1 か所 → 目的地たくさん」の所要時間をまとめて返す呼び方。
 * 1 件ずつ呼ぶより回数が少なくて済む。車は渋滞、電車・バスは時刻表（今から出発）が反映される。
 * 徒歩・自転車はここを呼ばない（徒歩は件数が多く費用がかさむ、自転車は日本で経路が提供されない。3.4.6）。
 * 失敗しても例外にせず「取れなかった（null）」を返し、呼び出し側が直線距離の計算に切り替える。
 */
const ENDPOINT = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";

/** Routes API に渡せる移動手段（徒歩・自転車は対象外） */
export type RoutesApiMode = Extract<TravelMode, "car" | "train" | "bus">;

export function isRoutesApiMode(mode: TravelMode): mode is RoutesApiMode {
  return mode === "car" || mode === "train" || mode === "bus";
}

export interface LatLng {
  lat: number;
  lng: number;
}

interface MatrixElement {
  originIndex?: number;
  destinationIndex?: number;
  duration?: string;
  condition?: string;
}

/** Routes API のリクエスト本体を作る（純粋関数。単体テストの対象） */
export function buildMatrixRequest(origin: LatLng, destinations: LatLng[], mode: RoutesApiMode, now: Date): Record<string, unknown> {
  const waypoint = (point: LatLng) => ({ waypoint: { location: { latLng: { latitude: point.lat, longitude: point.lng } } } });
  const base: Record<string, unknown> = {
    origins: [waypoint(origin)],
    destinations: destinations.map(waypoint),
    languageCode: "ja",
    units: "METRIC",
  };
  if (mode === "car") {
    return { ...base, travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE", departureTime: now.toISOString() };
  }
  // 電車とバスは同じ TRANSIT で、乗ってよい種別だけ変える
  return {
    ...base,
    travelMode: "TRANSIT",
    departureTime: now.toISOString(),
    transitPreferences: { allowedTravelModes: mode === "train" ? ["TRAIN", "SUBWAY", "RAIL"] : ["BUS"] },
  };
}

/**
 * 応答（要素の配列）を「目的地の順番どおりの分数」に直す（純粋関数）。
 * 経路が見つからなかった要素は null。`duration` は "1234s" の形。
 */
export function parseMatrixResponse(elements: MatrixElement[], destinationCount: number): (number | null)[] {
  const minutes: (number | null)[] = Array.from({ length: destinationCount }, () => null);
  for (const element of elements) {
    const index = element.destinationIndex;
    if (index === undefined || index < 0 || index >= destinationCount) continue;
    if (element.condition && element.condition !== "ROUTE_EXISTS") continue;
    const seconds = Number.parseFloat(element.duration ?? "");
    if (!Number.isFinite(seconds) || seconds < 0) continue;
    minutes[index] = Math.max(1, Math.ceil(seconds / 60));
  }
  return minutes;
}

/**
 * 出発地から各目的地までの所要時間（分）。取れなければ全部 null を返す（呼び出し側が目安に切り替える）。
 * 目的地は最大 25 か所まで（要件では画面に出す 20 件）。
 */
export async function fetchTravelMinutes(origin: LatLng, destinations: LatLng[], mode: RoutesApiMode, now: Date = new Date()): Promise<(number | null)[]> {
  const fallback = destinations.map(() => null);
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey || destinations.length === 0) return fallback;

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "originIndex,destinationIndex,duration,condition",
      },
      body: JSON.stringify(buildMatrixRequest(origin, destinations, mode, now)),
      cache: "no-store",
    });
    if (!response.ok) return fallback;
    const data = (await response.json()) as MatrixElement[] | { error?: unknown };
    if (!Array.isArray(data)) return fallback;
    return parseMatrixResponse(data, destinations.length);
  } catch {
    // 通信の失敗・上限・応答の形が違う、のいずれでも目安に切り替える（画面にエラーは出さない）
    return fallback;
  }
}
