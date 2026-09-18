/**
 * 出典: docs/tasks/map-search/search-top/01-suggest-api.md（単体テスト）「「おおさ」で 大阪府 が先頭になる」
 */
import { describe, expect, it } from "vitest";
import { matchPrefectures, PREFECTURES } from "./prefectures";

describe("matchPrefectures", () => {
  it("47 都道府県が定義されている", () => {
    expect(PREFECTURES).toHaveLength(47);
  });
  it("読みの前方一致で見つかる（カタカナも可）", () => {
    expect(matchPrefectures("おおさ")[0]?.name).toBe("大阪府");
    expect(matchPrefectures("オオサ")[0]?.name).toBe("大阪府");
  });
  it("漢字の前方一致で見つかる", () => {
    expect(matchPrefectures("東京")[0]?.name).toBe("東京都");
  });
  it("空なら空", () => {
    expect(matchPrefectures("  ")).toEqual([]);
  });
});
