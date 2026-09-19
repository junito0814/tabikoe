import { describe, expect, it } from "vitest";
import { clampDayIndex, dayCount, dayDate, formatDayLabel, isPeriodPast, validatePeriod } from "./day-utils";

/**
 * 出典: docs/tasks/itinerary/itinerary-days/01-period-update-and-day-recalc.md 単体テスト
 * - Day n の日付計算
 * - 3 日→2 日に縮めたとき Day 3 のスポットが未定になること（clampDayIndex）
 */
describe("day-utils", () => {
  it("日数と Day n の日付", () => {
    expect(dayCount("2026-09-20", "2026-09-22")).toBe(3);
    expect(dayCount("2026-09-20", "2026-09-20")).toBe(1);
    expect(dayCount(null, null)).toBe(0);
    expect(dayDate("2026-09-20", 1)).toBe("2026-09-20");
    expect(dayDate("2026-09-20", 3)).toBe("2026-09-22");
    // 月またぎ
    expect(dayDate("2026-09-30", 2)).toBe("2026-10-01");
    expect(dayDate(null, 1)).toBeNull();
  });

  it("期間を縮めると範囲外の Day は未定（null）", () => {
    expect(clampDayIndex(3, 2)).toBeNull();
    expect(clampDayIndex(2, 2)).toBe(2);
    expect(clampDayIndex(null, 2)).toBeNull();
    // 期間解除は全部未定
    expect(clampDayIndex(1, 0)).toBeNull();
  });

  it("期間の検証", () => {
    expect(validatePeriod("2026-09-20", "2026-09-22")).toEqual({ ok: true, startDate: "2026-09-20", endDate: "2026-09-22" });
    expect(validatePeriod("", "")).toEqual({ ok: true, startDate: null, endDate: null });
    expect(validatePeriod("2026-09-20", null)).toEqual({ ok: false, error: "period_incomplete" });
    expect(validatePeriod("2026-09-22", "2026-09-20")).toEqual({ ok: false, error: "period_reversed" });
    expect(validatePeriod("2026-02-30", "2026-03-01")).toEqual({ ok: false, error: "invalid_date" });
    expect(validatePeriod("2026-01-01", "2026-03-01")).toEqual({ ok: false, error: "period_too_long" });
  });

  it("ラベルと期間終了の判定", () => {
    expect(formatDayLabel("2026-09-20")).toBe("9/20（日）");
    expect(isPeriodPast("2026-09-10", "2026-09-18")).toBe(true);
    expect(isPeriodPast("2026-09-18", "2026-09-18")).toBe(false);
    expect(isPeriodPast(null, "2026-09-18")).toBe(false);
  });
});

describe("formatPeriodLabel（v3.1: 年つき）", () => {
  it("開始と終了を年つきで、未設定なら「期間未設定」", async () => {
    const { formatPeriodLabel } = await import("./day-utils");
    expect(formatPeriodLabel("2026-09-20", "2026-09-22")).toBe("2026/9/20（日） 〜 2026/9/22（火）");
    expect(formatPeriodLabel(null, null)).toBe("期間未設定");
  });
});
