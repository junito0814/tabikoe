import { describe, expect, it } from "vitest";
import {
  haversineMeters,
  matchesCostRange,
  matchesFilters,
  parsePostSearchParams,
  type PostSearchFilters,
} from "./search-posts";

/**
 * 出典: docs/tasks/map-search/post-filter/01-post-filter-handler.md 単体テスト
 * - 各絞り込み条件（キーワード・カテゴリ・距離・費用・滞在時間）が単独および組み合わせで正しく機能することを検証する
 * - 費用未入力の投稿が費用絞り込み時に除外されることを検証する
 * - 非公開投稿が結果に含まれないことを検証する
 */
const none: PostSearchFilters = {
  keyword: null,
  categories: [],
  distanceMeters: null,
  center: null,
  costRange: null,
  duration: null,
};

const tokyoStation = { lat: 35.6812, lng: 139.7671 };

const post = (overrides: Partial<Parameters<typeof matchesFilters>[0]> = {}) => ({
  visibility: "public",
  category: "グルメ",
  cost: 1500,
  duration: "1時間以内",
  spot: { name: "東京駅 グランスタ", lat: 35.6812, lng: 139.7671 },
  ...overrides,
});

describe("matchesFilters", () => {
  it("条件なしなら公開投稿はすべて通る", () => {
    expect(matchesFilters(post(), none)).toBe(true);
  });

  it("非公開投稿は条件に関わらず含まれない", () => {
    expect(matchesFilters(post({ visibility: "private" }), none)).toBe(false);
  });

  it("キーワードはスポット名の部分一致", () => {
    expect(matchesFilters(post(), { ...none, keyword: "グランスタ" })).toBe(true);
    expect(matchesFilters(post(), { ...none, keyword: "新宿" })).toBe(false);
  });

  it("カテゴリは複数選択のいずれかに一致", () => {
    expect(matchesFilters(post(), { ...none, categories: ["観光スポット", "グルメ"] })).toBe(true);
    expect(matchesFilters(post(), { ...none, categories: ["宿泊施設"] })).toBe(false);
  });

  it("距離は地図の中心からの円内", () => {
    // 東京駅から約1.1km 東（有楽町方面より少し先）
    const nearby = post({ spot: { name: "近く", lat: 35.6812, lng: 139.7791 } });
    expect(matchesFilters(nearby, { ...none, center: tokyoStation, distanceMeters: 3000 })).toBe(true);
    expect(matchesFilters(nearby, { ...none, center: tokyoStation, distanceMeters: 500 })).toBe(false);
  });

  it("費用はレンジ判定", () => {
    expect(matchesFilters(post({ cost: 800 }), { ...none, costRange: "1000" })).toBe(true);
    expect(matchesFilters(post({ cost: 1500 }), { ...none, costRange: "1000" })).toBe(false);
    expect(matchesFilters(post({ cost: 1500 }), { ...none, costRange: "3000" })).toBe(true);
    expect(matchesFilters(post({ cost: 6000 }), { ...none, costRange: "5000" })).toBe(false);
    expect(matchesFilters(post({ cost: 6000 }), { ...none, costRange: "over" })).toBe(true);
    expect(matchesFilters(post({ cost: 5000 }), { ...none, costRange: "over" })).toBe(true);
  });

  it("費用未入力の投稿は費用で絞り込むと除外され、絞り込まなければ含まれる", () => {
    expect(matchesFilters(post({ cost: null }), { ...none, costRange: "1000" })).toBe(false);
    expect(matchesFilters(post({ cost: null }), { ...none, costRange: "over" })).toBe(false);
    expect(matchesFilters(post({ cost: null }), none)).toBe(true);
  });

  it("滞在時間は完全一致", () => {
    expect(matchesFilters(post(), { ...none, duration: "1時間以内" })).toBe(true);
    expect(matchesFilters(post(), { ...none, duration: "それ以上" })).toBe(false);
  });

  it("複数条件の組み合わせはすべて満たす必要がある", () => {
    const filters: PostSearchFilters = {
      keyword: "東京駅",
      categories: ["グルメ"],
      center: tokyoStation,
      distanceMeters: 1000,
      costRange: "3000",
      duration: "1時間以内",
    };
    expect(matchesFilters(post(), filters)).toBe(true);
    expect(matchesFilters(post({ category: "宿泊施設" }), filters)).toBe(false);
    expect(matchesFilters(post({ cost: 4000 }), filters)).toBe(false);
  });
});

describe("matchesCostRange", () => {
  it("境界値を含む", () => {
    expect(matchesCostRange(1000, "1000")).toBe(true);
    expect(matchesCostRange(0, "1000")).toBe(true);
    expect(matchesCostRange(1001, "1000")).toBe(false);
  });
});

describe("haversineMeters", () => {
  it("東京駅〜新宿駅はおよそ6.5km", () => {
    const shinjuku = { lat: 35.6896, lng: 139.7006 };
    const distance = haversineMeters(tokyoStation, shinjuku);
    expect(distance).toBeGreaterThan(6000);
    expect(distance).toBeLessThan(7000);
  });
});

describe("parsePostSearchParams", () => {
  it("すべての条件を読む", () => {
    const params = new URLSearchParams({
      q: " 東京 ",
      categories: "グルメ,観光スポット,存在しない",
      distance: "1000",
      lat: "35.68",
      lng: "139.76",
      cost: "3000",
      duration: "30分以内",
    });
    expect(parsePostSearchParams(params)).toEqual({
      keyword: "東京",
      categories: ["グルメ", "観光スポット"],
      distanceMeters: 1000,
      center: { lat: 35.68, lng: 139.76 },
      costRange: "3000",
      duration: "30分以内",
    });
  });

  it("不正な値は無視し、基準座標が無ければ距離も無効", () => {
    const params = new URLSearchParams({ distance: "1000", cost: "abc", duration: "x" });
    expect(parsePostSearchParams(params)).toEqual({
      keyword: null,
      categories: [],
      distanceMeters: null,
      center: null,
      costRange: null,
      duration: null,
    });
  });
});
