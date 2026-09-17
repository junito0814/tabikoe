import { describe, expect, it } from "vitest";
import { addSpotsHref } from "./add-mode";

/**
 * 出典: docs/tasks/itinerary/add-spots/02-add-mode.md 単体テスト
 * - 行き先の自動決定（最多の都道府県、空なら検索トップ）
 */
describe("addSpotsHref", () => {
  it("最多の都道府県で投稿一覧を追加モードで開く", () => {
    const href = addSpotsHref("it-1", 2, ["大阪府", "京都府", "大阪府", null]);
    expect(href).toBe("/search?pref=%E5%A4%A7%E9%98%AA%E5%BA%9C&itinerary=it-1&day=2");
  });

  it("しおりが空なら検索トップ（未定タブなら day 無し）", () => {
    expect(addSpotsHref("it-1", null, [])).toBe("/?itinerary=it-1");
    expect(addSpotsHref("it-1", 1, [null, null])).toBe("/?itinerary=it-1&day=1");
  });
});
