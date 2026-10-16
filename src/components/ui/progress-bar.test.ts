import { describe, expect, it } from "vitest";
import { MIN_VISIBLE_PERCENT, progressPercent } from "./progress-bar";

/**
 * 出典: Issue #940「幅の計算は純粋関数に切り出してテストする（約束 13）」
 *
 * 画面の作りが変わっても壊れやすいのは計算のほうなので、ここだけで押さえる。
 */
describe("progressPercent（#940）", () => {
  it("点数の割合を % にする", () => {
    expect(progressPercent({ done: 1, total: 4 })).toBe(25);
    expect(progressPercent({ done: 3, total: 4 })).toBe(75);
    expect(progressPercent({ done: 4, total: 4 })).toBe(100);
  });

  it("まだ総数が分からないときは null（呼ぶ側は「流れる」表示にする）", () => {
    expect(progressPercent(null)).toBeNull();
  });

  it("総数が 0 でも壊れない（0 で割らない）", () => {
    expect(progressPercent({ done: 0, total: 0 })).toBeNull();
    expect(progressPercent({ done: 2, total: 0 })).toBeNull();
    expect(progressPercent({ done: 1, total: -1 })).toBeNull();
  });

  it("数え過ぎても 100% で止まる（バーが枠からはみ出さない）", () => {
    expect(progressPercent({ done: 9, total: 4 })).toBe(100);
  });

  it("0 件目でも少しだけ出す（幅 0 だと「出ていない」と同じに見える）", () => {
    expect(progressPercent({ done: 0, total: 4 })).toBe(MIN_VISIBLE_PERCENT);
    expect(progressPercent({ done: -1, total: 4 })).toBe(MIN_VISIBLE_PERCENT);
  });

  it("おかしな値（NaN・Infinity）でも null に倒す", () => {
    expect(progressPercent({ done: Number.NaN, total: 4 })).toBeNull();
    expect(progressPercent({ done: 1, total: Number.POSITIVE_INFINITY })).toBeNull();
  });
});
