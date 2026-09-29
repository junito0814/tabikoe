import { describe, expect, it } from "vitest";
import { jstDayOf, shouldTouchLastActiveDay } from "./last-active-day";

/** 出典: docs/tasks/admin/admin-shell-dashboard/03-last-active.md 単体テスト */
describe("shouldTouchLastActiveDay", () => {
  // 2026-09-26 23:30 JST（UTC では 14:30）
  const now = new Date("2026-09-26T14:30:00Z");

  it("日付は日本時間で切る", () => {
    expect(jstDayOf(now)).toBe("2026-09-26");
    expect(jstDayOf(new Date("2026-09-26T15:00:00Z"))).toBe("2026-09-27"); // JST 0:00
  });

  it("Cookie が無い／昨日なら true、今日なら false", () => {
    expect(shouldTouchLastActiveDay(undefined, now)).toBe(true);
    expect(shouldTouchLastActiveDay("2026-09-25", now)).toBe(true);
    expect(shouldTouchLastActiveDay("2026-09-26", now)).toBe(false);
    expect(shouldTouchLastActiveDay("garbage", now)).toBe(true);
  });
});
