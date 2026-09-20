"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * arrival-time Task2: 10 分刻みの時刻ピッカー
 * 出典: docs/tasks/itinerary/arrival-time/02-time-picker-10min.md
 *       要件定義書 v3.0 3.11.3（ブラウザ標準の時刻入力は iPhone が刻みを無視するため自前）
 *
 * 【初心者向け】「時（0〜23）」と「分（00／10／…／50）」の 2 列を縦に並べ、それぞれをスクロールして選ぶ。
 * 選ぶと `onChange("HH:MM")`。「クリア」で null。キーボードでも操作できるよう、各列は `role="listbox"` で
 * ↑↓キーで動き、Enter で決定する。`<input type="time">` は使わない。
 */
export const HOURS = Array.from({ length: 24 }, (_, i) => i);
export const MINUTES = [0, 10, 20, 30, 40, 50] as const;

export function splitTime(value: string | null): { hour: number | null; minute: number | null } {
  if (!value) return { hour: null, minute: null };
  const [h, m] = value.split(":").map(Number);
  return { hour: Number.isInteger(h) ? h : null, minute: Number.isInteger(m) ? m : null };
}

export function joinTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function TimePicker10({
  value,
  onChange,
  onClose,
  label = "到着予定時刻",
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  onClose?: () => void;
  label?: string;
}) {
  const initial = splitTime(value);
  const [hour, setHour] = useState<number>(initial.hour ?? 10);
  const [minute, setMinute] = useState<number>(initial.minute ?? 0);
  const id = useId();

  return (
    <div role="group" aria-label={label} data-time-picker className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface p-3 shadow-card">
      <div className="flex justify-center gap-4">
        <Column id={`${id}-hour`} label="時" options={HOURS} value={hour} onChange={setHour} format={(v) => String(v)} />
        <span aria-hidden className="self-center text-[18px] font-bold text-ink">
          :
        </span>
        <Column id={`${id}-minute`} label="分" options={[...MINUTES]} value={minute} onChange={setMinute} format={(v) => String(v).padStart(2, "0")} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            onChange(null);
            onClose?.();
          }}
          className="text-[12px] font-medium text-muted underline underline-offset-2"
        >
          クリア
        </button>
        <button
          type="button"
          onClick={() => {
            onChange(joinTime(hour, minute));
            onClose?.();
          }}
          className="h-9 rounded-[8px] bg-ink px-4 text-[12px] font-semibold text-on-ink"
        >
          {joinTime(hour, minute)} にする
        </button>
      </div>
    </div>
  );
}

function Column({
  id,
  label,
  options,
  value,
  onChange,
  format,
}: {
  id: string;
  label: string;
  options: number[];
  value: number;
  onChange: (next: number) => void;
  format: (value: number) => string;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  // 選択中の項目が見える位置までスクロールする
  useEffect(() => {
    const selected = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    // jsdom には scrollIntoView が無いので存在を確かめてから呼ぶ
    if (selected && typeof selected.scrollIntoView === "function") selected.scrollIntoView({ block: "center" });
  }, [value]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const index = options.indexOf(value);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onChange(options[Math.min(options.length - 1, index + 1)]);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      onChange(options[Math.max(0, index - 1)]);
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(options[0]);
    } else if (event.key === "End") {
      event.preventDefault();
      onChange(options[options.length - 1]);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <span id={`${id}-label`} className="text-[10px] text-muted">
        {label}
      </span>
      <ul
        ref={listRef}
        role="listbox"
        aria-labelledby={`${id}-label`}
        aria-activedescendant={`${id}-${value}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="h-[132px] w-16 snap-y snap-mandatory overflow-y-auto rounded-[8px] border border-line bg-app focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {options.map((option) => {
          const selected = option === value;
          return (
            <li
              key={option}
              id={`${id}-${option}`}
              role="option"
              aria-selected={selected}
              onClick={() => onChange(option)}
              className={`flex h-11 snap-center cursor-pointer items-center justify-center text-[16px] ${selected ? "bg-accent font-bold text-white" : "text-ink"}`}
            >
              {format(option)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
