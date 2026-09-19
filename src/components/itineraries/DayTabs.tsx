"use client";

import { formatDayLabel } from "@/lib/itineraries/day-utils";
import type { ItinerarySpotItem } from "@/lib/itineraries/get-itinerary";

/**
 * itinerary-days Task2 / itinerary-check Task3 / mentoring-7 Task8（v3.1）: Day タブ（ALL／Day 1／…。各タブに「済み／全体」）
 * 出典: docs/tasks/itinerary/itinerary-days/02-day-tabs-and-move-ui.md
 *       docs/tasks/shared-ui/mentoring-7/08-itinerary-detail.md
 *       要件定義書 v3.1 3.11.2（左端は ALL。日付なしのスポットは ALL にだけ出る。「未定」タブは置かない）
 *
 * 【初心者向け】タブは「ALL＋日数分」。期間未設定なら ALL だけ。
 * `DayKey`（number | null）は「スポットがどの Day に属するか」（null＝日付なし）で、`DayTab`（"all" | number）は「今どのタブを見ているか」。
 * 2 つを分けているのは、日付なしのスポットは専用のタブを持たず ALL にだけ出るため。件数は純粋関数 countByDay で数える。
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

export function DayTabs({
  dayCount,
  dayDates,
  spots,
  value,
  onChange,
  className,
}: {
  dayCount: number;
  dayDates: string[];
  spots: Pick<ItinerarySpotItem, "dayIndex" | "checkedAt">[];
  value: DayTab;
  onChange: (tab: DayTab) => void;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label="Day" className={`flex gap-1.5 overflow-x-auto pb-1 ${className ?? ""}`} style={{ scrollbarWidth: "none" }}>
      {dayTabKeys(dayCount).map((tab) => {
        const selected = tab === value;
        const count = countByDay(spots, tab);
        const date = tab === ALL_TAB ? "" : formatDayLabel(dayDates[tab - 1] ?? null);
        return (
          <button
            key={String(tab)}
            type="button"
            role="tab"
            aria-selected={selected}
            data-day={String(tab)}
            onClick={() => onChange(tab)}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ${
              selected ? "bg-ink text-white" : "border border-line bg-surface text-muted"
            }`}
          >
            {dayTabLabel(tab)}
            {date && <span className={`text-[10px] ${selected ? "text-white/80" : "text-muted"}`}>{date}</span>}
            {count.total > 0 && (
              <span className={`rounded-full px-1.5 text-[10px] ${selected ? "bg-white/20" : "bg-tint"}`}>
                {count.checked}/{count.total}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
