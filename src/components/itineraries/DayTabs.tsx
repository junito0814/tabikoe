"use client";

import { formatDayLabel } from "@/lib/itineraries/day-utils";
import type { ItinerarySpotItem } from "@/lib/itineraries/get-itinerary";
import { ALL_TAB, countByDay, dayTabKeys, dayTabLabel, type DayTab } from "@/lib/itineraries/day-tabs";

/**
 * itinerary-days Task2 / itinerary-check Task3 / mentoring-7 Task8（v3.1）: Day タブ（ALL／Day 1／…。各タブに「済み／全体」）
 * 出典: docs/tasks/itinerary/itinerary-days/02-day-tabs-and-move-ui.md
 *       docs/tasks/shared-ui/mentoring-7/08-itinerary-detail.md
 *
 * 【初心者向け】タブは「ALL＋日数分」。期間未設定なら ALL だけ。
 * 純粋関数（parseDayTab など）は lib/itineraries/day-tabs.ts にある（Server Component からも呼ぶため。#462）。
 * 互換のためここからも再 export する。
 */
export { ALL_TAB, countByDay, dayKeys, daysInTab, dayTabKeys, dayTabLabel, parseDayTab } from "@/lib/itineraries/day-tabs";
export type { DayKey, DayTab } from "@/lib/itineraries/day-tabs";

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
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[0.75rem] font-semibold ${
              selected ? "bg-ink text-on-ink" : "border border-line bg-surface text-muted"
            }`}
          >
            {dayTabLabel(tab)}
            {date && <span className={`text-[0.625rem] ${selected ? "text-white/80" : "text-muted"}`}>{date}</span>}
            {count.total > 0 && (
              <span className={`rounded-full px-1.5 text-[0.625rem] ${selected ? "bg-white/20" : "bg-tint"}`}>
                {count.checked}/{count.total}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
