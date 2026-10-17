import { describe, expect, it } from "vitest";
import {
  buildPostSearchParams,
  buildSearchPageHref,
  countActiveFilters,
  EMPTY_SEARCH_STATE,
  parseSearchState,
  type SearchContext,
} from "./post-search-query";
import type { VisitFinding } from "@/lib/spots/visit-findings";

/**
 * 出典: docs/tasks/map-search/post-filter/02-filter-ui.md 単体テスト
 *       docs/tasks/map-search/post-timeline/03-scroll-and-back.md 単体テスト
 * - 絞り込み条件の選択状態が API のクエリ・画面の URL に正しく反映され、URL から復元できること
 */
const nearby: SearchContext = { destination: { kind: "nearby", lat: 35.6812, lng: 139.7671, label: "東京駅" } };
const pref: SearchContext = { destination: { kind: "prefecture", name: "大阪府" } };
/*
 * #955（2026-10-16）: 期間（訪問日）は**スポット別の投稿一覧でだけ**使う条件になった。
 * 検索結果（都道府県・駅・みんなの投稿）はスポットの一覧で、絞り込みシートに期間を出さないため。
 */
const spotCtx: SearchContext = { destination: { kind: "spot", spotId: "spot-1" } };

describe("buildPostSearchParams", () => {
  it("行き先＋選択した条件だけをクエリに載せる", () => {
    const params = buildPostSearchParams(
      { ...EMPTY_SEARCH_STATE, categories: ["グルメ", "観光スポット"], distance: 1000, cost: "3000", duration: "1時間以内", rating: 4, sort: "rating" },
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
      rating: "4",
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

  it("日付指定は from/to を付ける（スポット別の投稿一覧）", () => {
    const params = buildPostSearchParams({ ...EMPTY_SEARCH_STATE, period: "custom", from: "2026-05-01", to: "" }, spotCtx, 0);
    expect(params.get("period")).toBe("custom");
    expect(params.get("from")).toBe("2026-05-01");
    expect(params.has("to")).toBe(false);
  });

  // #955: スポットの一覧は期間を出さないので、持っていても送らない（効いているのに消せない条件を作らない）
  it("スポットの一覧では、期間を送らない／評価（平均）を送る", () => {
    const state = { ...EMPTY_SEARCH_STATE, period: "this_month" as const, rating: 4 };
    expect(buildPostSearchParams(state, pref, 0).has("period")).toBe(false);
    expect(buildPostSearchParams(state, pref, 0).get("rating")).toBe("4");
    // 逆に、スポット別の投稿一覧では評価（平均）が無い（1 件の投稿に「平均」は無いため）
    expect(buildPostSearchParams(state, spotCtx, 0).has("rating")).toBe(false);
    expect(buildPostSearchParams(state, spotCtx, 0).get("period")).toBe("this_month");
  });

  // #929: 「行ってわかったこと」もスポットの一覧だけ（投稿を 1 件ずつ絞る画面には出さない）
  it("スポットの一覧では「行ってわかったこと」を送り、スポット別では送らない", () => {
    const state = { ...EMPTY_SEARCH_STATE, findings: ["pet", "parking"] as VisitFinding[] };
    expect(buildPostSearchParams(state, pref, 0).get("findings")).toBe("pet,parking");
    expect(buildPostSearchParams(state, spotCtx, 0).has("findings")).toBe(false);
  });
});

describe("buildSearchPageHref / parseSearchState", () => {
  it("URL に書いた条件をそのまま読み戻せる（往復）", () => {
    // v3.1: 都道府県の検索結果はスポット単位なので並び替えは 新着順／評価順／投稿数順（いいね順はスポット別だけ）
    const state = { ...EMPTY_SEARCH_STATE, categories: ["グルメ" as const], cost: "1000" as const, rating: 3, findings: ["pet", "parking"] as VisitFinding[], sort: "count" as const };
    const href = buildSearchPageHref(state, { ...pref, addMode: { itinerary: "it-1", day: "2" } });
    expect(href).toContain("/search?pref=");
    expect(href).toContain("itinerary=it-1");
    expect(href).toContain("day=2");
    const params = new URL(`https://example.com${href}`).searchParams;
    expect(parseSearchState(params, pref)).toEqual(state);
  });

  it("不正な値は捨て、座標付きの q はキーワードにしない", () => {
    const params = new URLSearchParams({ q: "東京駅", categories: "存在しない", distance: "999", cost: "x", period: "y", from: "bad", sort: "z", findings: "wifi" });
    expect(parseSearchState(params, nearby)).toEqual(EMPTY_SEARCH_STATE);
    expect(parseSearchState(new URLSearchParams({ q: "東京" }), pref).keyword).toBe("東京");
  });

  // #929: URL から来た値をそのまま信じない。知らない項目は落とし、決まった順に並べ直す
  it("「行ってわかったこと」は知らない項目を落とし、決まった順に並べ直す", () => {
    const params = new URLSearchParams({ findings: "parking,wifi,pet" });
    expect(parseSearchState(params, pref).findings).toEqual(["pet", "parking"]);
    // スポット別の一覧では出さない条件なので、URL に残っていても読まない
    expect(parseSearchState(params, spotCtx).findings).toEqual([]);
  });
});

describe("countActiveFilters", () => {
  it("適用中の種類数を数える（距離は基準点があるときだけ、並び替えは数えない）", () => {
    const state = { ...EMPTY_SEARCH_STATE, categories: ["グルメ" as const], distance: 1000 as const, sort: "likes" as const };
    expect(countActiveFilters(state, nearby)).toBe(2);
    expect(countActiveFilters(state, pref)).toBe(1);

    /*
     * #955: 出していない条件は数えない。
     *   スポットの一覧 … 期間は数えず、評価（平均）を数える
     *   スポット別     … 期間を数え、評価（平均）は持っていても数えない
     * 距離はどちらでもシートに出していないが、駅の検索など別の経路から URL に入るので今までどおり数える。
     */
    const withBoth = { ...EMPTY_SEARCH_STATE, period: "this_month" as const, rating: 4 };
    expect(countActiveFilters(withBoth, pref)).toBe(1);
    expect(countActiveFilters(withBoth, spotCtx)).toBe(1);
  });

  // #929: 何個選んでも 1 つ（カテゴリと同じ）。スポット別では数えない
  it("「行ってわかったこと」は、何個選んでも 1 つとして数える", () => {
    const state = { ...EMPTY_SEARCH_STATE, findings: ["pet", "parking", "card"] as VisitFinding[] };
    expect(countActiveFilters(state, pref)).toBe(1);
    expect(countActiveFilters(state, spotCtx)).toBe(0);
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
