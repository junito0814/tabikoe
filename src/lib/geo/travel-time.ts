import { haversineMeters } from "./walk-minutes";

/**
 * feedback-0919 Task7（v3.2）: 移動手段ごとの半径と所要時間の目安
 * 出典: docs/tasks/shared-ui/feedback-0919/07-travel-mode.md
 *       要件定義書 v3.2 3.4.6「移動手段」（徒歩 1km・80m/分、自転車 3km・250m/分、車 10km・500m/分）
 *
 * 【初心者向け】経路 API（Directions／Routes）は使わず、直線距離 ÷ 速度を切り上げた「目安」を出す。
 * 徒歩は不動産広告と同じ 80m/分（walk-minutes.ts と同じ）。バス・電車は課金方針が決まるまで設けない（要件定義書 9 章 #11）。
 */
export const TRAVEL_MODES = ["walk", "bicycle", "car"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];
export const DEFAULT_TRAVEL_MODE: TravelMode = "walk";

export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = { walk: "徒歩", bicycle: "自転車", car: "車" };
/** 「近くのスポット」を探す半径（m） */
export const TRAVEL_RADIUS_METERS: Record<TravelMode, number> = { walk: 1000, bicycle: 3000, car: 10000 };
/** 速度（m/分） */
export const TRAVEL_SPEED_METERS_PER_MINUTE: Record<TravelMode, number> = { walk: 80, bicycle: 250, car: 500 };

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

/** 表示文言: 「徒歩 6分」「自転車で約 8分」「車で約 12分」 */
export function formatTravelMinutes(minutes: number, mode: TravelMode): string {
  return mode === "walk" ? `徒歩 ${minutes}分` : `${TRAVEL_MODE_LABELS[mode]}で約 ${minutes}分`;
}
