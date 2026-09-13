import { describe, expect, it } from "vitest";
import { gridColumnsForWidth, MAX_GALLERY_COLUMNS, MIN_GALLERY_COLUMNS } from "./gallery-columns";

/**
 * 出典: docs/tasks/map-search/spot-photo-gallery/02-gallery-screen-ui.md 単体テスト
 * - 画面幅に応じたグリッド列数の切り替えロジックを検証する
 */
describe("gridColumnsForWidth", () => {
  it("スマートフォン幅（〜400px）は3列", () => {
    expect(gridColumnsForWidth(320)).toBe(3);
    expect(gridColumnsForWidth(390)).toBe(3);
  });

  it("幅が広がるにつれて列数が増える", () => {
    expect(gridColumnsForWidth(450)).toBe(4);
    expect(gridColumnsForWidth(560)).toBe(5);
    expect(gridColumnsForWidth(700)).toBe(6);
  });

  it("上限・下限の範囲に収まる", () => {
    expect(gridColumnsForWidth(2000)).toBe(MAX_GALLERY_COLUMNS);
    expect(gridColumnsForWidth(0)).toBe(MIN_GALLERY_COLUMNS);
    expect(gridColumnsForWidth(Number.NaN)).toBe(MIN_GALLERY_COLUMNS);
  });
});
