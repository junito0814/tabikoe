import { describe, expect, it } from "vitest";
import {
  applyFilters,
  haversineMeters,
  matchesCostRange,
  matchesFilters,
  parsePeriod,
  parsePostSearchParams,
  type PostSearchFilters, durationsMatching } from "./search-posts";

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

  it("滞在時間は完全一致。v3.2: 半日／1日／宿泊 を選ぶと旧「それ以上」の投稿も含む", () => {
    expect(matchesFilters(post(), { ...none, duration: "1時間以内" })).toBe(true);
    expect(matchesFilters(post(), { ...none, duration: "宿泊" })).toBe(false);
    expect(matchesFilters(post({ duration: "それ以上" }), { ...none, duration: "半日" })).toBe(true);
    expect(matchesFilters(post({ duration: "それ以上" }), { ...none, duration: "1時間以内" })).toBe(false);
    expect(durationsMatching("宿泊")).toEqual(["宿泊", "それ以上"]);
    expect(durationsMatching("30分以内")).toEqual(["30分以内"]);
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
      // v3.0: 座標付きの q は周辺検索のラベル（スポット名の絞り込みではない）
      keyword: null,
      categories: ["グルメ", "観光スポット"],
      distanceMeters: 1000,
      center: { lat: 35.68, lng: 139.76 },
      costRange: "3000",
      duration: "30分以内",
      destination: { kind: "nearby", center: { lat: 35.68, lng: 139.76 }, label: "東京" },
      visitFrom: null,
      visitTo: null,
      sort: "newest",
      viewer: null,
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
      destination: null,
      visitFrom: null,
      visitTo: null,
      sort: "newest",
      viewer: null,
    });
  });

  it("v3.0: 都道府県・スポット別・座標の 3 通りの行き先を読む", () => {
    expect(parsePostSearchParams(new URLSearchParams({ pref: "大阪府" })).destination).toEqual({ kind: "prefecture", name: "大阪府" });
    expect(parsePostSearchParams(new URLSearchParams({ spot: "spot-1", pref: "大阪府" })).destination).toEqual({ kind: "spot", spotId: "spot-1" });
    expect(parsePostSearchParams(new URLSearchParams({ lat: "34.7", lng: "135.5", q: "大阪駅" })).destination).toEqual({
      kind: "nearby",
      center: { lat: 34.7, lng: 135.5 },
      label: "大阪駅",
    });
  });

  it("v3.0: 並び替え・閲覧者の現在地を読む", () => {
    const filters = parsePostSearchParams(new URLSearchParams({ sort: "likes", vlat: "35.0", vlng: "135.0" }));
    expect(filters.sort).toBe("likes");
    expect(filters.viewer).toEqual({ lat: 35, lng: 135 });
    expect(parsePostSearchParams(new URLSearchParams({ sort: "x" })).sort).toBe("newest");
  });
});

describe("parsePeriod", () => {
  it("今月・先月は月初〜月末", () => {
    expect(parsePeriod(new URLSearchParams({ period: "this_month" }), "2026-09-18")).toEqual({ visitFrom: "2026-09-01", visitTo: "2026-09-30" });
    expect(parsePeriod(new URLSearchParams({ period: "last_month" }), "2026-09-18")).toEqual({ visitFrom: "2026-08-01", visitTo: "2026-08-31" });
    // 1 月の先月は前年 12 月
    expect(parsePeriod(new URLSearchParams({ period: "last_month" }), "2026-01-05")).toEqual({ visitFrom: "2025-12-01", visitTo: "2025-12-31" });
  });

  it("日付指定は from/to をそのまま（形式が違えば無視）", () => {
    expect(parsePeriod(new URLSearchParams({ period: "custom", from: "2026-05-01", to: "bad" }), "2026-09-18")).toEqual({ visitFrom: "2026-05-01", visitTo: null });
    expect(parsePeriod(new URLSearchParams(), "2026-09-18")).toEqual({ visitFrom: null, visitTo: null });
  });
});

describe("matchesFilters（v3.0 の行き先・期間）", () => {
  const base = { visibility: "public", category: "グルメ", cost: 1000, duration: "30分以内", visit_date: "2026-09-03" };
  const spot = { id: "s1", name: "たこ焼き", lat: 34.7025, lng: 135.4959, prefecture: "大阪府" };
  const emptyFilters = parsePostSearchParams(new URLSearchParams());

  it("都道府県が一致しなければ除外", () => {
    expect(matchesFilters({ ...base, spot }, { ...emptyFilters, destination: { kind: "prefecture", name: "大阪府" } })).toBe(true);
    expect(matchesFilters({ ...base, spot }, { ...emptyFilters, destination: { kind: "prefecture", name: "京都府" } })).toBe(false);
  });

  it("周辺 5km の外は除外", () => {
    const near = { kind: "nearby" as const, center: { lat: 34.70, lng: 135.50 }, label: null };
    const far = { kind: "nearby" as const, center: { lat: 35.0, lng: 135.5 }, label: null };
    expect(matchesFilters({ ...base, spot }, { ...emptyFilters, destination: near })).toBe(true);
    expect(matchesFilters({ ...base, spot }, { ...emptyFilters, destination: far })).toBe(false);
  });

  it("訪問日が期間の外・未設定なら除外", () => {
    expect(matchesFilters({ ...base, spot }, { ...emptyFilters, visitFrom: "2026-09-01", visitTo: "2026-09-30" })).toBe(true);
    expect(matchesFilters({ ...base, spot }, { ...emptyFilters, visitFrom: "2026-10-01", visitTo: null })).toBe(false);
    expect(matchesFilters({ ...base, spot, visit_date: null }, { ...emptyFilters, visitFrom: "2026-09-01", visitTo: null })).toBe(false);
  });
});

/*
 * post-timeline Task 6（2026-10-03）: 判定はクエリ側で行う
 * 出典: docs/tasks/map-search/post-timeline/06-manual-only-filter.md 6-2
 *
 * 【初心者向け】取ってから捨てると「1 回に 20 件」のページングの数が合わなくなる
 * （捨てたぶん足りない一覧になる）。so クエリに条件として載せる。
 */
describe("applyFilters: タビコエだけの場所", () => {
  /** 呼ばれた内容だけ覚える、鎖のようにつながる偽のクエリ */
  function fakeQuery() {
    const calls: string[] = [];
    const self: Record<string, unknown> = {};
    for (const name of ["eq", "in", "ilike", "gte", "lte", "not", "or", "order", "range", "limit"]) {
      self[name] = (...args: unknown[]) => {
        calls.push(`${name}(${args.map((a) => JSON.stringify(a)).join(",")})`);
        return self;
      };
    }
    return { query: self as unknown as Parameters<typeof applyFilters>[0], calls };
  }

  const base = { keyword: null, categories: [], distanceMeters: null, center: null, costRange: null, duration: null };

  /**
   * #680（2026-10-05）: 「タビコエだけの場所」は概念ごと廃止（決定事項 70）。
   * `spots.source` はデータとして残すが、**絞り込みの条件には使わない**。
   */
  it("spots.source はクエリに載らない", () => {
    const { query, calls } = fakeQuery();
    applyFilters(query, base, []);
    expect(calls.some((call) => call.includes("spots.source"))).toBe(false);
  });
});
