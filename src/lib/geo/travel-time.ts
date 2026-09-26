import { haversineMeters } from "./walk-minutes";

/**
 * feedback-0919 Task7（v3.2）／travel-time Task1・2（2026-09-25 改訂）: 移動手段ごとの半径と所要時間
 * 出典: docs/tasks/map-search/travel-time/01-routes-api-client.md・02-travel-modes-and-display.md
 *       要件定義書 3.4.6「半径と所要時間」、4.5.7「所要時間の言い方」
 *
 * 【初心者向け】2026-09-25 の変更点は 3 つ。
 *   1. 電車・バスを追加して 5 つになった
 *   2. 車・電車・バスは Routes API の実測（lib/google/routes.ts）。徒歩・自転車はここの計算のまま
 *   3. 徒歩を 80 → 60m/分に。不動産広告の「1 分＝80m」は“道のり”の値で、実際の道は直線の約 1.3 倍あるため、
 *      直線距離のまま使うには 80 ÷ 1.3 ≒ 60 が実態に近い。自転車 180m/分（時速 11km 相当）も同じ考え方
 * 表示は「徒歩 約 6 分」のように `〈移動手段〉 約 N 分` で統一する（実測か計算かは利用者に見せない）。
 */
export const TRAVEL_MODES = ["walk", "bicycle", "car", "train", "bus"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];
export const DEFAULT_TRAVEL_MODE: TravelMode = "walk";

export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = { walk: "徒歩", bicycle: "自転車", car: "車", train: "電車", bus: "バス" };

/** 「近くのスポット」を探す半径（m） */
/**
 * 【初心者向け】半径は距離ではなく「移動にかけてよい時間」で揃えている（要件定義書 3.4.6）。
 * 下の速度で割ると 徒歩・自転車が約 17 分、バス・車・電車が約 33〜40 分になる。
 * バスは 2026-09-26 に 5km（約 25 分）→ 8km（約 40 分）へ。そこだけ短く、旅先で 30〜40 分のバスは普通のため。
 */
export const TRAVEL_RADIUS_METERS: Record<TravelMode, number> = { walk: 1000, bicycle: 3000, car: 10000, train: 15000, bus: 8000 };

/**
 * 直線距離から所要時間を出すときの速度（m/分）。
 * 徒歩・自転車は常にこれ。車・電車・バスは Routes API が使えなかったときだけ使う。
 */
export const TRAVEL_SPEED_METERS_PER_MINUTE: Record<TravelMode, number> = { walk: 60, bicycle: 180, car: 300, train: 400, bus: 200 };

export function parseTravelMode(value: string | null | undefined): TravelMode {
  return (TRAVEL_MODES as readonly string[]).includes(value ?? "") ? (value as TravelMode) : DEFAULT_TRAVEL_MODE;
}

/** 距離（m）→ 所要時間（分、切り上げ。0m でも 1 分） */
export function travelMinutes(distanceMeters: number, mode: TravelMode): number {
  return Math.max(1, Math.ceil(distanceMeters / TRAVEL_SPEED_METERS_PER_MINUTE[mode]));
}

export function travelMinutesBetween(from: { lat: number; lng: number }, to: { lat: number; lng: number }, mode: TravelMode): number {
  return travelMinutes(haversineMeters(from, to), mode);
}

/** 表示文言: 「徒歩 約 6 分」「自転車 約 12 分」「車 約 12 分」（4.5.7 で統一） */
export function formatTravelMinutes(minutes: number, mode: TravelMode): string {
  return `${TRAVEL_MODE_LABELS[mode]} 約 ${minutes}分`;
}
