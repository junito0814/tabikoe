import { describe, expect, it } from "vitest";
import { dayButtonLabel, dayLabel } from "./DayMoveDropdown";

/**
 * #753・#871: ボタンの顔だけ「未選択」にする（塊の見出し・トーストは「日付なし」のまま）
 * 出典: 要件定義書 3.11、2026-10-06 の相談
 */
describe("dayButtonLabel（#753）", () => {
  it("日付なしは「未選択」（#871）", () => {
    expect(dayButtonLabel(null)).toBe("未選択");
  });

  it("Day が決まっていれば「Day 1」", () => {
    expect(dayButtonLabel(1)).toBe("Day 1");
    expect(dayButtonLabel(3)).toBe("Day 3");
  });

  it("dayLabel 自体は変えない（塊の見出し・移動後のトースト・保存先シートの選択肢で使うため）", () => {
    expect(dayLabel(null)).toBe("日付なし");
    expect(dayLabel(2)).toBe("Day 2");
  });
});
