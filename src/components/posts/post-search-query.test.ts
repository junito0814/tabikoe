import { describe, expect, it } from "vitest";
import {
  buildPostSearchParams,
  buildSearchPageHref,
  countActiveFilters,
  EMPTY_SEARCH_STATE,
  parseSearchState,
  type SearchContext,
} from "./post-search-query";

/**
 * 出典: docs/tasks/map-search/post-filter/02-filter-ui.md 単体テスト
 *       docs/tasks/map-search/post-timeline/03-scroll-and-back.md 単体テスト
 * - 絞り込み条件の選択状態が API のクエリ・画面の URL に正しく反映され、URL から復元できること
 */
const nearby: SearchContext = { destination: { kind: "nearby", lat: 35.6812, lng: 139.7671, label: "東京駅" } };
const pref: SearchContext = { destination: { kind: "prefecture", name: "大阪府" } };

describe("buildPostSearchParams", () => {
  it("行き先＋選択した条件だけをクエリに載せる", () => {
    const params = buildPostSearchParams(
      { ...EMPTY_SEARCH_STATE, categories: ["グルメ", "観光スポット"], distance: 1000, cost: "3000", duration: "1時間以内", period: "this_month", sort: "rating" },
      nearby,
      20,
      { lat: 35, lng: 139 }
    );
    expect(Object.fromEntries(params)).toEqual({
      lat: "35.6812",
      lng: "139.7671",
      q: "東京駅",
      categories: "グルメ,観光スポット",
      distance: "1000",
      cost: "3000",
      duration: "1時間以内",
      period: "this_month",
      sort: "rating",
      vlat: "35",
      vlng: "139",
      offset: "20",
    });
  });

  it("条件なしなら行き先だけ、距離は基準点が無ければ送らない", () => {
    expect(buildPostSearchParams(EMPTY_SEARCH_STATE, { destination: null }, 0).toString()).toBe("");
    const params = buildPostSearchParams({ ...EMPTY_SEARCH_STATE, distance: 500 }, pref, 0);
    expect(Object.fromEntries(params)).toEqual({ pref: "大阪府" });
  });

  it("日付指定は from/to を付ける", () => {
    const params = buildPostSearchParams({ ...EMPTY_SEARCH_STATE, period: "custom", from: "2026-05-01", to: "" }, pref, 0);
    expect(params.get("period")).toBe("custom");
    expect(params.get("from")).toBe("2026-05-01");
    expect(params.has("to")).toBe(false);
  });
});

describe("buildSearchPageHref / parseSearchState", () => {
  it("URL に書いた条件をそのまま読み戻せる（往復）", () => {
    // v3.1: 都道府県の検索結果はスポット単位なので並び替えは 新着順／評価順／投稿数順（いいね順はスポット別だけ）
    const state = { ...EMPTY_SEARCH_STATE, categories: ["グルメ" as const], cost: "1000" as const, period: "last_month" as const, sort: "count" as const };
    const href = buildSearchPageHref(state, { ...pref, addMode: { itinerary: "it-1", day: "2" } });
    expect(href).toContain("/search?pref=");
    expect(href).toContain("itinerary=it-1");
    expect(href).toContain("day=2");
    const params = new URL(`https://example.com${href}`).searchParams;
    expect(parseSearchState(params, pref)).toEqual(state);
  });

  it("不正な値は捨て、座標付きの q はキーワードにしない", () => {
    const params = new URLSearchParams({ q: "東京駅", categories: "存在しない", distance: "999", cost: "x", period: "y", from: "bad", sort: "z" });
    expect(parseSearchState(params, nearby)).toEqual(EMPTY_SEARCH_STATE);
    expect(parseSearchState(new URLSearchParams({ q: "東京" }), pref).keyword).toBe("東京");
  });
});

describe("countActiveFilters", () => {
  it("適用中の種類数を数える（距離は基準点があるときだけ、並び替えは数えない）", () => {
    const state = { ...EMPTY_SEARCH_STATE, categories: ["グルメ" as const], distance: 1000 as const, sort: "likes" as const };
    expect(countActiveFilters(state, nearby)).toBe(2);
    expect(countActiveFilters(state, pref)).toBe(1);
  });
});

/**
 * #680（2026-10-05）: 「タビコエだけの場所」は概念ごと廃止（決定事項 70）。
 * URL に `manual=1` が残っていても、何も起きない（古いリンクを開いても壊れない）。
 */
describe("#680: manual=1 は無視する", () => {
  it("古いリンクを開いても条件にならない", () => {
    const state = parseSearchState(new URLSearchParams("pref=東京都&manual=1"), pref);
    expect(countActiveFilters(state, pref)).toBe(0);
    expect(buildSearchPageHref(state, pref)).not.toContain("manual");
  });
});
