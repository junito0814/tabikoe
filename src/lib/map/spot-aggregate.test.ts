import { describe, expect, it } from "vitest";
import {
  activeSpotFilterCount,
  aggregateSpot,
  aggregateSpots,
  parseSpotFilters,
  spotFiltersToParams,
  averageCost,
  averageRating,
  EMPTY_SPOT_FILTERS,
  hasActiveSpotFilters,
  matchesSpotFilters,
  resolveSpotDuration,
  type SpotPostInput,
} from "./spot-aggregate";
import { resolveSpotCategory } from "./spot-category";

/**
 * 出典: docs/tasks/map-search/explore-mode/04-filter.md 単体テスト
 * 要件定義書 3.4.6「絞り込み」「スポットの代表値の決め方」・8 章 100
 *
 * 【初心者向け】ここでいちばん大事なのは「**投稿 1 件ではなく、スポットの代表値で絞る**」こと。
 * 「誰かが 1 回だけ 3,000 円で済んだ店」ではなく「だいたい 3,000 円の店」が出るようにする。
 */
const post = (over: Partial<SpotPostInput> = {}): SpotPostInput => ({
  category: "グルメ",
  duration: "1時間以内",
  cost: 1000,
  rating: 4,
  createdAt: "2026-09-01T00:00:00Z",
  ...over,
});

describe("resolveSpotDuration: いちばん多い滞在時間", () => {
  it("いちばん多いものを返す", () => {
    const result = resolveSpotDuration([
      { duration: "1時間以内", createdAt: "2026-09-01T00:00:00Z" },
      { duration: "半日", createdAt: "2026-09-02T00:00:00Z" },
      { duration: "1時間以内", createdAt: "2026-09-03T00:00:00Z" },
    ]);
    expect(result).toBe("1時間以内");
  });

  it("同数なら新しい方", () => {
    const result = resolveSpotDuration([
      { duration: "1時間以内", createdAt: "2026-09-01T00:00:00Z" },
      { duration: "半日", createdAt: "2026-09-05T00:00:00Z" },
    ]);
    expect(result).toBe("半日");
  });

  it("未入力は数えない", () => {
    const result = resolveSpotDuration([
      { duration: null, createdAt: "2026-09-09T00:00:00Z" },
      { duration: null, createdAt: "2026-09-08T00:00:00Z" },
      { duration: "宿泊", createdAt: "2026-09-01T00:00:00Z" },
    ]);
    expect(result).toBe("宿泊");
  });

  it("全部未入力なら null", () => {
    expect(resolveSpotDuration([{ duration: null, createdAt: null }])).toBeNull();
  });

  it("知らない値は数えない（DB に古い値が残っていても落ちない）", () => {
    expect(resolveSpotDuration([{ duration: "それ以上", createdAt: null }])).toBeNull();
  });
});

describe("averageCost: 費用の平均", () => {
  it("入っているものだけで平均する", () => {
    expect(averageCost([1000, 3000, null])).toBe(2000);
  });

  it("全部未入力なら null（0 円ではない）", () => {
    expect(averageCost([null, null])).toBeNull();
  });

  it("小数は切り捨てる", () => {
    expect(averageCost([1000, 1001])).toBe(1000);
  });
});

describe("averageRating: 評価の平均", () => {
  it("小数 1 桁に丸める", () => {
    expect(averageRating([5, 4, 4])).toBe(4.3);
  });

  it("未入力は数えない", () => {
    expect(averageRating([5, null])).toBe(5);
  });

  it("全部未入力なら null", () => {
    expect(averageRating([null])).toBeNull();
  });
});

describe("aggregateSpot: カテゴリはピンの色と同じ関数を使う", () => {
  it("resolveSpotCategory と同じ答えになる（違う色のピンが残らない）", () => {
    const posts = [
      post({ category: "グルメ", createdAt: "2026-09-01T00:00:00Z" }),
      post({ category: "観光スポット", createdAt: "2026-09-02T00:00:00Z" }),
      post({ category: "観光スポット", createdAt: "2026-09-03T00:00:00Z" }),
    ];
    const expected = resolveSpotCategory(posts);
    expect(aggregateSpot(posts).category).toBe(expected);
    expect(expected).toBe("観光スポット");
  });
});

describe("matchesSpotFilters: 代表値で絞る（ここが仕様の中心）", () => {
  const filters = (over: Partial<typeof EMPTY_SPOT_FILTERS> = {}) => ({ ...EMPTY_SPOT_FILTERS, ...over });
  const spot = { manual: false };

  it("平均 3.5 のスポットは「★4 以上」に残らない（★5 が 1 件あっても）", () => {
    // 「誰かが 1 回 ★5 を付けた店」ではなく「だいたい良い店」を出すのが狙い
    const aggregate = aggregateSpot([post({ rating: 5 }), post({ rating: 2 })]);
    expect(aggregate.ratingAverage).toBe(3.5);
    expect(matchesSpotFilters(aggregate, spot, filters({ minRating: 4 }))).toBe(false);
  });

  it("「★4 以上」は 4.0 ちょうどを含む", () => {
    const aggregate = aggregateSpot([post({ rating: 4 }), post({ rating: 4 })]);
    expect(aggregate.ratingAverage).toBe(4);
    expect(matchesSpotFilters(aggregate, spot, filters({ minRating: 4 }))).toBe(true);
  });

  it("評価が全部未入力なら、評価で絞ると落ちる", () => {
    const aggregate = aggregateSpot([post({ rating: null })]);
    expect(matchesSpotFilters(aggregate, spot, filters({ minRating: 1 }))).toBe(false);
  });

  it("予算は平均で見る（1 件だけ安くても残らない）", () => {
    const aggregate = aggregateSpot([post({ cost: 500 }), post({ cost: 9000 })]);
    expect(aggregate.costAverage).toBe(4750);
    expect(matchesSpotFilters(aggregate, spot, filters({ cost: "3000" }))).toBe(false);
    expect(matchesSpotFilters(aggregate, spot, filters({ cost: "5000" }))).toBe(true);
  });

  it("費用が全部未入力のスポットは、予算で絞ると落ちる", () => {
    const aggregate = aggregateSpot([post({ cost: null })]);
    expect(matchesSpotFilters(aggregate, spot, filters({ cost: "1000" }))).toBe(false);
  });

  it("カテゴリは代表（いちばん多いもの）で見る", () => {
    // グルメ 1 件・観光 2 件 → 代表は観光。「グルメ」で絞ると落ちる
    const aggregate = aggregateSpot([
      post({ category: "グルメ" }),
      post({ category: "観光スポット" }),
      post({ category: "観光スポット" }),
    ]);
    expect(matchesSpotFilters(aggregate, spot, filters({ categories: ["グルメ"] }))).toBe(false);
    expect(matchesSpotFilters(aggregate, spot, filters({ categories: ["観光スポット"] }))).toBe(true);
  });

  it("滞在時間は選んだものと一致するかで見る（投稿一覧と同じ）", () => {
    // durationsMatching は「選んだもの＋廃止した旧値」を返す。
    // 「半日以上の束」ではない（半日を選んでも 1日 は出ない）
    const aggregate = aggregateSpot([post({ duration: "1日" })]);
    expect(matchesSpotFilters(aggregate, spot, filters({ duration: "1日" }))).toBe(true);
    expect(matchesSpotFilters(aggregate, spot, filters({ duration: "半日" }))).toBe(false);
  });

  it("廃止した旧値「それ以上」の投稿は、半日・1日・宿泊のどれでも拾う", () => {
    // DB に残っている旧値を取りこぼさないため（投稿一覧と同じ扱い）
    const aggregate = { ...aggregateSpot([post()]), duration: "それ以上" as never };
    expect(matchesSpotFilters(aggregate, spot, filters({ duration: "半日" }))).toBe(true);
    expect(matchesSpotFilters(aggregate, spot, filters({ duration: "1時間以内" }))).toBe(false);
  });


  it("条件が無ければ、どのスポットも残る", () => {
    const aggregate = aggregateSpot([post({ cost: null, duration: null, category: null, rating: null })]);
    expect(matchesSpotFilters(aggregate, spot, EMPTY_SPOT_FILTERS)).toBe(true);
  });

  it("条件は「かつ」で効く", () => {
    const aggregate = aggregateSpot([post({ category: "グルメ", cost: 1000, rating: 5 })]);
    expect(matchesSpotFilters(aggregate, spot, filters({ categories: ["グルメ"], minRating: 5 }))).toBe(true);
    expect(matchesSpotFilters(aggregate, spot, filters({ categories: ["宿泊施設"], minRating: 5 }))).toBe(false);
  });
});

describe("効いている条件の数（ボタンに付ける数字）", () => {
  it("条件が無ければ 0 で、効いていない", () => {
    expect(activeSpotFilterCount(EMPTY_SPOT_FILTERS)).toBe(0);
    expect(hasActiveSpotFilters(EMPTY_SPOT_FILTERS)).toBe(false);
  });

  it("入れた数だけ増える", () => {
    const f = { ...EMPTY_SPOT_FILTERS, categories: ["グルメ"] as const, cost: "3000" as const };
    expect(activeSpotFilterCount(f)).toBe(2);
    expect(hasActiveSpotFilters(f)).toBe(true);
  });

  it("カテゴリは何個選んでも 1 つと数える", () => {
    const f = { ...EMPTY_SPOT_FILTERS, categories: ["グルメ", "観光スポット"] as const };
    expect(activeSpotFilterCount(f)).toBe(1);
  });
});

describe("aggregateSpots（ピンとカードで同じ答えを出す 1 か所）", () => {
  const spot = (id: string, posts: SpotPostInput[], manual = false) => ({ id, manual, posts });
  const p = (over: Partial<SpotPostInput> = {}): SpotPostInput => ({
    category: "グルメ",
    duration: "1時間以内",
    cost: 1000,
    rating: 5,
    createdAt: "2026-09-01T00:00:00Z",
    ...over,
  });

  it("投稿が 0 件のスポットは入らない", () => {
    expect(aggregateSpots([spot("a", [])], EMPTY_SPOT_FILTERS).has("a")).toBe(false);
  });

  it("条件に合うスポットだけが残る", () => {
    const result = aggregateSpots(
      [spot("a", [p({ category: "グルメ" })]), spot("b", [p({ category: "宿泊施設" })])],
      { ...EMPTY_SPOT_FILTERS, categories: ["グルメ"] }
    );
    expect([...result.keys()]).toEqual(["a"]);
  });

  it("残ったスポットの件数・評価は、そのスポットの**全公開投稿**から出る（受入条件 100）", () => {
    // 条件は「グルメ」。このスポットの 3 件のうち 1 件は星 2 だが、件数も平均も 3 件ぶんで出す
    // （投稿を間引くのではなく、スポットごと残すか落とすかを決めているため）
    const result = aggregateSpots(
      [spot("a", [p({ rating: 5 }), p({ rating: 5 }), p({ rating: 2 })])],
      { ...EMPTY_SPOT_FILTERS, categories: ["グルメ"] }
    );
    expect(result.get("a")?.postCount).toBe(3);
    expect(result.get("a")?.ratingAverage).toBe(4);
  });

});

describe("URL クエリの読み書き", () => {
  it("5 つの条件を読む", () => {
    const filters = parseSpotFilters(new URLSearchParams("categories=グルメ,観光スポット&cost=3000&duration=1時間以内&rating=4&manual=1"));
    expect(filters).toEqual({
      categories: ["グルメ", "観光スポット"],
      cost: "3000",
      duration: "1時間以内",
      minRating: 4,
    });
  });

  it("おかしな値は無視する（地図が出ないより、条件なしで出す）", () => {
    const filters = parseSpotFilters(new URLSearchParams("categories=そんなカテゴリ&cost=abc&duration=3年&rating=0&manual=yes"));
    expect(filters).toEqual(EMPTY_SPOT_FILTERS);
    // 星は 1〜5 の整数だけ（6 や 3.5 は受けない）
    expect(parseSpotFilters(new URLSearchParams("rating=6")).minRating).toBeNull();
    expect(parseSpotFilters(new URLSearchParams("rating=3.5")).minRating).toBeNull();
  });

  it("書いて読み直すと同じ条件に戻る（URL と地図の状態の保存はこれに頼っている）", () => {
    const filters = { categories: ["観光スポット"] as const, cost: "1000" as const, duration: "30分以内" as const, minRating: 5 };
    const restored = parseSpotFilters(new URLSearchParams(spotFiltersToParams(filters)));
    expect(restored).toEqual(filters);
  });

  it("条件なしの項目は URL に載せない（余計なクエリを増やさない）", () => {
    expect(spotFiltersToParams(EMPTY_SPOT_FILTERS)).toEqual([]);
  });
});
