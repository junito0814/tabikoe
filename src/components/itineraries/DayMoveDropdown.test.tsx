import { describe, expect, it } from "vitest";
import { dayLabel } from "./DayMoveDropdown";

/**
 * 2026-10-07: Day の言い方を「日付なし」1 つにそろえた。
 *
 * 【初心者向け】#753 では行のボタンだけ「Day を決める」、#871 で「未選択」にしていたが、
 * **同じものを 3 つの言い方で呼ぶ**ことになって、かえって分かりにくかった。
 * 塊の見出し・移動後のトースト・保存先シートの選択肢・行のボタンの**全部**で `dayLabel` を使う（約束 14）。
 * 出典: 要件定義書 3.11、2026-10-06・2026-10-07 の相談
 */
describe("dayLabel", () => {
  it("日付なしは「日付なし」", () => {
    expect(dayLabel(null)).toBe("日付なし");
  });

  it("Day が決まっていれば「Day 1」", () => {
    expect(dayLabel(1)).toBe("Day 1");
    expect(dayLabel(3)).toBe("Day 3");
  });
});
