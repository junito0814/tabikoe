"use client";

import { useEffect, useId, useRef, useState } from "react";
import { dayTabKeys, type DayKey } from "./DayTabs";

/**
 * itinerary-days Task2: 行の「Day n ▾」ドロップダウン（Day の移動）
 * 出典: docs/tasks/itinerary/itinerary-days/02-day-tabs-and-move-ui.md
 *
 * 【初心者向け】SortDropdown と同じ作り（ボタン＋listbox、外側クリックと Esc で閉じる）。
 * 選ぶと onChange(移動先)。画面は今の Day に留まり、トーストは親が出す。
 */
export function dayLabel(day: DayKey): string {
  return day === null ? "未定" : `Day ${day}`;
}

export function DayMoveDropdown({ value, dayCount, onChange, disabled = false }: { value: DayKey; dayCount: number; onChange: (day: DayKey) => void; disabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-label={`Day を移動: ${dayLabel(value)}`}
        className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-[11px] font-semibold text-ink disabled:opacity-45"
      >
        {dayLabel(value)}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && (
        <ul id={listId} role="listbox" aria-label="移動先の Day" className="absolute right-0 z-20 mt-1 min-w-[120px] overflow-hidden rounded-[10px] border border-line bg-surface py-1 shadow-card">
          {dayTabKeys(dayCount).map((day) => {
            const selected = day === value;
            return (
              <li key={day ?? "undecided"} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setIsOpen(false);
                    if (!selected) onChange(day);
                  }}
                  className={`flex w-full px-3 py-2 text-left text-[12px] ${selected ? "font-semibold text-accent" : "text-ink"} hover:bg-tint`}
                >
                  {dayLabel(day)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
