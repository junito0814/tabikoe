"use client";

import { formatDayLabel } from "@/lib/itineraries/day-utils";
import type { ItinerarySpotItem } from "@/lib/itineraries/get-itinerary";

/**
 * itinerary-days Task2 / itinerary-check Task3: Day タブ（Day 1／…／日付なし。各タブに「済み／全体」）
 * 出典: docs/tasks/itinerary/itinerary-days/02-day-tabs-and-move-ui.md
 *       docs/tasks/itinerary/itinerary-check/03-row-display-and-map-pins.md
 *
 * 【初心者向け】タブの数は「日数＋1（日付なし）」。期間未設定なら日付なしだけ（v3.1 の ALL タブは Task 8 で入れる）。
 * `value` は選択中の Day（null＝日付なし）。件数はスポット一覧から数える（純粋関数 countByDay）。
 */
export type DayKey = number | null;

export function countByDay(spots: Pick<ItinerarySpotItem, "dayIndex" | "checkedAt">[], day: DayKey): { total: number; checked: number } {
  const inDay = spots.filter((spot) => spot.dayIndex === day);
  return { total: inDay.length, checked: inDay.filter((spot) => spot.checkedAt !== null).length };
}

export function dayTabKeys(dayCount: number): DayKey[] {
  return [...Array.from({ length: dayCount }, (_, i) => i + 1), null];
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
  value: DayKey;
  onChange: (day: DayKey) => void;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label="Day" className={`flex gap-1.5 overflow-x-auto pb-1 ${className ?? ""}`} style={{ scrollbarWidth: "none" }}>
      {dayTabKeys(dayCount).map((day) => {
        const selected = day === value;
        const count = countByDay(spots, day);
        const label = day === null ? "日付なし" : `Day ${day}`;
        const date = day === null ? "" : formatDayLabel(dayDates[day - 1] ?? null);
        return (
          <button
            key={day ?? "undecided"}
            type="button"
            role="tab"
            aria-selected={selected}
            data-day={day ?? "undecided"}
            onClick={() => onChange(day)}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ${
              selected ? "bg-ink text-white" : "border border-line bg-surface text-muted"
            }`}
          >
            {label}
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
