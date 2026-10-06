import { describe, expect, it } from "vitest";
import { ALL_TAB, countByDay, dayKeys, dayTabKeys, dayTabLabel, daysInTab, parseDayTab } from "./day-tabs";

/**
 * Day タブの純粋関数の単体テスト
 * 出典: Issue #759「ALL では「日付なし」を先頭に出す」
 *
 * 【初心者向け】並びの判断をここ 1 つ（`daysInTab`）に閉じ込めてあるので、
 * 一覧も地図のピンの番号もこの関数を直せば揃います（約束 13）。
 */
describe("daysInTab（#759）", () => {
  it("ALL は「日付なし」が先頭、続いて Day 1〜n", () => {
    expect(daysInTab(ALL_TAB, 3)).toEqual([null, 1, 2, 3]);
  });

  it("期間が未定（Day が 0 日）の ALL は「日付なし」だけ", () => {
    expect(daysInTab(ALL_TAB, 0)).toEqual([null]);
  });

  it("Day を選んでいるときはその Day だけ（今までどおり）", () => {
    expect(daysInTab(1, 3)).toEqual([1]);
    expect(daysInTab(3, 3)).toEqual([3]);
  });

  it("「どこへ移すか」の選択肢（dayKeys）は変えない ── Day 1〜n → 日付なし", () => {
    expect(dayKeys(3)).toEqual([1, 2, 3, null]);
  });
});

describe("そのほかの Day タブの関数", () => {
  it("タブの並びは ALL が左端", () => {
    expect(dayTabKeys(2)).toEqual([ALL_TAB, 1, 2]);
  });

  it("ALL の件数は全部、Day の件数はその Day だけ", () => {
    const spots = [
      { dayIndex: 1, checkedAt: "2026-10-01" },
      { dayIndex: 1, checkedAt: null },
      { dayIndex: null, checkedAt: null },
    ];
    expect(countByDay(spots, ALL_TAB)).toEqual({ total: 3, checked: 1 });
    expect(countByDay(spots, 1)).toEqual({ total: 2, checked: 1 });
  });

  it("?day= は数字ならその Day、範囲外・旧 undecided・空なら ALL", () => {
    expect(parseDayTab("2", 3)).toBe(2);
    expect(parseDayTab("9", 3)).toBe(ALL_TAB);
    expect(parseDayTab("undecided", 3)).toBe(ALL_TAB);
    expect(parseDayTab(null, 3)).toBe(ALL_TAB);
  });

  it("タブの文字", () => {
    expect(dayTabLabel(ALL_TAB)).toBe("ALL");
    expect(dayTabLabel(2)).toBe("Day 2");
  });
});
