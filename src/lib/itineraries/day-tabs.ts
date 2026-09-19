import type { ItinerarySpotItem } from "@/lib/itineraries/get-itinerary";

/**
 * itinerary-days Task2 / mentoring-7 Task8（v3.1）/ Bug 1（#462）: Day タブの純粋関数
 * 出典: docs/tasks/shared-ui/mentoring-7/08-itinerary-detail.md
 *       要件定義書 v3.1 3.11.2（左端は ALL。日付なしのスポットは ALL にだけ出る）
 *
 * 【初心者向け】ここには画面（React）を含めない。`"use client"` を付けたファイルから export した関数は
 * Server Component（page.tsx）から呼べないため（#419・#462）、page.tsx でも使う `parseDayTab` などはこの lib に置く。
 * `DayKey`（number | null）は「スポットがどの Day に属するか」（null＝日付なし）、`DayTab`（"all" | number）は「今どのタブを見ているか」。
 */
export type DayKey = number | null;
export const ALL_TAB = "all" as const;
export type DayTab = typeof ALL_TAB | number;

export function countByDay(spots: Pick<ItinerarySpotItem, "dayIndex" | "checkedAt">[], tab: DayTab): { total: number; checked: number } {
  const inTab = tab === ALL_TAB ? spots : spots.filter((spot) => spot.dayIndex === tab);
  return { total: inTab.length, checked: inTab.filter((spot) => spot.checkedAt !== null).length };
}

/** タブの並び: ALL が左端、続いて Day 1〜n */
export function dayTabKeys(dayCount: number): DayTab[] {
  return [ALL_TAB, ...Array.from({ length: dayCount }, (_, i) => i + 1)];
}

/** スポットが属せる Day の一覧（Day 1〜n → 日付なし）。Day の移動・保存先シートの選択肢に使う */
export function dayKeys(dayCount: number): DayKey[] {
  return [...Array.from({ length: dayCount }, (_, i) => i + 1), null];
}

/** タブに含まれる Day の一覧（ALL は Day の順 → 日付なし）。地図のピンや ALL の一覧の並びに使う */
export function daysInTab(tab: DayTab, dayCount: number): DayKey[] {
  return tab === ALL_TAB ? [...Array.from({ length: dayCount }, (_, i) => i + 1), null] : [tab];
}

/** URL の ?day=（"all"／数字／旧 "undecided"）→ タブ。不正なら ALL */
export function parseDayTab(value: string | null | undefined, dayCount: number): DayTab {
  if (value === undefined || value === null || value === "" || value === ALL_TAB || value === "undecided") return ALL_TAB;
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 1 && n <= dayCount ? n : ALL_TAB;
}

export function dayTabLabel(tab: DayTab): string {
  return tab === ALL_TAB ? "ALL" : `Day ${tab}`;
}
