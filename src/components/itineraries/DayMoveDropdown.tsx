"use client";

import { dayKeys, type DayKey } from "./DayTabs";
import { Select } from "@/components/ui/Select";

/**
 * itinerary-days Task2: 行の「Day n ▾」ドロップダウン（Day の移動）
 * 出典: docs/tasks/itinerary/itinerary-days/02-day-tabs-and-move-ui.md
 *
 * 【初心者向け】ブラウザ標準の `<select>`（#812）。選ぶと onChange(移動先)。
 * 画面は今の Day に留まり、トーストは親が出す。
 */
export function dayLabel(day: DayKey): string {
  return day === null ? "日付なし" : `Day ${day}`;
}

/*
 * 2026-10-07: 「Day を決める」→「未選択」→**「日付なし」に戻した**。
 *
 * 【初心者向け】#753 では、日付なしの塊にいる行のボタンだけ別の言葉にしていた
 * （その塊にいる時点で日付なしだと分かるので、くどいという理由）。#871 で「未選択」にしたが、
 * **同じものを 3 つの言い方で呼んでいる**ことになり、かえって分かりにくかった。
 * 塊の見出し・移動後のトースト・保存先シート・行のボタンの**全部を「日付なし」にそろえる**（約束 14）。
 */

export function DayMoveDropdown({ value, dayCount, onChange, disabled = false }: { value: DayKey; dayCount: number; onChange: (day: DayKey) => void; disabled?: boolean }) {
  /*
   * #812（2026-10-06）: 自前のリストをやめ、ブラウザ標準の `<select>` にした。
   *
   * 【初心者向け】`DayKey` は `number | null`（null＝日付なし）ですが、
   * `<select>` の値は**文字でしか持てません**。そこで `null` を `"none"` という文字に
   * 置き換えて渡し、選ばれたら戻します。
   */
  const toKey = (day: DayKey) => (day === null ? "none" : String(day));
  const fromKey = (key: string): DayKey => (key === "none" ? null : Number(key));
  const options = dayKeys(dayCount).map(toKey);
  return (
    <Select
      value={toKey(value)}
      onChange={(key) => {
        const next = fromKey(key);
        if (next !== value) onChange(next);
      }}
      options={options}
      /*
       * 2026-10-07: 顔に出す文字も選択肢も、全部 `dayLabel`（「日付なし」「Day 1」…）にそろえた。
       */
      label={(key) => dayLabel(fromKey(key))}
      ariaLabel={value === null ? "Day は日付なし（押すと選べます）" : `Day を移動: ${dayLabel(value)}`}
      disabled={disabled}
    />
  );
}
