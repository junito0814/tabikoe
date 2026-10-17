import { describe, expect, it } from "vitest";
import { filterSpotsByAverage } from "./search-spots";

/**
 * #955（2026-10-16）: スポットの一覧を「平均」で絞る
 * 出典: Issue #955、要件定義書 3.4.2・4.5.19
 *
 * 【初心者向け】ここが直したかったことです。前は**投稿 1 件でも条件に合えば**そのスポットが出ていました。
 * 1 件だけ 5,000 円の投稿があると「5,000 円の店」として出てしまい、平均が 800 円でも同じ扱いでした。
 */
const spot = (over: Partial<{ ratingSum: number; ratingCount: number; costSum: number; costCount: number }> = {}) => ({
  ratingSum: 0,
  ratingCount: 0,
  costSum: 0,
  costCount: 0,
  ...over,
});

describe("filterSpotsByAverage", () => {
  it("条件が無ければ、そのまま全部返す", () => {
    const spots = [spot(), spot({ costSum: 9999, costCount: 1 })];
    expect(filterSpotsByAverage(spots, { cost: null, minRating: null })).toHaveLength(2);
  });

  it("予算は平均で見る（1 件だけ高い投稿があっても、平均が収まっていれば出す）", () => {
    // 800 + 800 + 5000 = 6600 ÷ 3 = 2200 → 「〜3000 円」に入る
    const cheapOnAverage = spot({ costSum: 6600, costCount: 3 });
    // 4000 ÷ 1 = 4000 → 入らない
    const expensive = spot({ costSum: 4000, costCount: 1 });
    const kept = filterSpotsByAverage([cheapOnAverage, expensive], { cost: "3000", minRating: null });
    expect(kept).toEqual([cheapOnAverage]);
  });

  it("費用が 1 件も入っていないスポットは、予算で絞ると出さない", () => {
    // 要件 3.4.4 の「費用が未入力の投稿は、費用で絞り込むと表示されない」と同じ考え方
    expect(filterSpotsByAverage([spot()], { cost: "1000", minRating: null })).toEqual([]);
  });

  it("評価は平均が下限以上のものだけ", () => {
    const good = spot({ ratingSum: 9, ratingCount: 2 }); // 4.5
    const poor = spot({ ratingSum: 6, ratingCount: 2 }); // 3.0
    expect(filterSpotsByAverage([good, poor], { cost: null, minRating: 4 })).toEqual([good]);
  });

  it("星が 1 件も無いスポットは、評価で絞ると出さない", () => {
    expect(filterSpotsByAverage([spot({ costSum: 500, costCount: 1 })], { cost: null, minRating: 3 })).toEqual([]);
  });

  it("予算と評価は両方満たすものだけ", () => {
    const both = spot({ costSum: 1000, costCount: 1, ratingSum: 5, ratingCount: 1 });
    const costOnly = spot({ costSum: 1000, costCount: 1, ratingSum: 2, ratingCount: 1 });
    const ratingOnly = spot({ costSum: 9000, costCount: 1, ratingSum: 5, ratingCount: 1 });
    expect(filterSpotsByAverage([both, costOnly, ratingOnly], { cost: "1000", minRating: 4 })).toEqual([both]);
  });
});
