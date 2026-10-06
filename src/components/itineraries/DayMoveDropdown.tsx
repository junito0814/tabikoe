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

/**
 * #753（2026-10-06）: ボタンの顔に出す文字。
 *
 * 【初心者向け】「日付なし」の塊にいる行で「日付なし ▾」と出すと、**その塊にいる時点で
 * 日付なしだと分かる**ぶんくどい。やること（Day を決める）を書く。
 * `dayLabel` 自体は変えない ── あれは**塊の見出し・移動後のトースト・保存先シートの選択肢**でも
 * 使っており、そこで「Day を決める」になると日本語として壊れるため（6 か所中ここだけ変える）。
 */
export function dayButtonLabel(day: DayKey): string {
  return day === null ? "Day を決める" : dayLabel(day);
}

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
       * #753: 「日付なし」の行では、顔に出す文字だけ「Day を決める」にする。
       * その塊にいる時点で日付なしだと分かるので、やること（Day を決める）を書く。
       * Day が決まっている行の一覧では「日付なし」のまま（そちらは「日付を外す」選択肢なので）。
       */
      label={(key) => (key === "none" && value === null ? dayButtonLabel(null) : dayLabel(fromKey(key)))}
      ariaLabel={value === null ? "Day を決める" : `Day を移動: ${dayLabel(value)}`}
      disabled={disabled}
    />
  );
}
