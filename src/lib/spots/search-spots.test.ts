import { describe, expect, it } from "vitest";
import { aggregateSpotCards, parseSpotSort, sortSpotCards } from "./search-spots";
import type { SearchRow } from "@/lib/posts/search-posts";

/**
 * 出典: docs/tasks/shared-ui/mentoring-7/03-spot-cards.md 単体テスト
 * - 同じスポットの投稿が複数あっても 1 件のスポットカードになること
 * - 並び替え（新着順／評価順／投稿数順）の順序
 */
const row = (id: string, spotId: string, overrides: Partial<SearchRow> = {}): SearchRow => ({
  id,
  spot_id: spotId,
  user_id: "u1",
  category: "グルメ",
  visit_date: "2026-09-03",
  duration: "1時間以内",
  cost: 1000,
  rating: 4,
  comment: `感想 ${id}\n2 行目`,
  created_at: `2026-09-0${id.slice(-1)}T00:00:00Z`,
  visibility: "public",
  spots: { id: spotId, name: `スポット ${spotId}`, lat: 35, lng: 139, source: spotId === "s2" ? "manual" : "places", prefecture: "東京都" },
  users: { display_name: "たろう", avatar_url: null },
  post_photos: [{ storage_url: `${id}.jpg`, media_type: "photo", display_order: 0 }],
  likes: [{ count: 0 }],
  comments: [{ count: 0 }],
  ...overrides,
});

describe("aggregateSpotCards", () => {
  it("同じスポットの投稿が複数あっても 1 件にまとまり、件数・★の平均・最新の感想と写真が付く", () => {
    // 新着順（先頭が最新）で渡す
    const spots = aggregateSpotCards([row("p3", "s1", { rating: 5 }), row("p2", "s1", { rating: 3 }), row("p1", "s2", { rating: null })]);
    expect(spots.map((s) => s.id)).toEqual(["s1", "s2"]);
    const s1 = spots[0];
    expect(s1.postCount).toBe(2);
    expect(s1.ratingSum / s1.ratingCount).toBe(4);
    expect(s1.latestPostAt).toBe("2026-09-03T00:00:00Z");
    expect(s1.latestComment).toBe("感想 p3");
    expect(s1.coverPath).toBe("p3.jpg");
    expect(spots[1].ratingCount).toBe(0);
    expect(spots[1].source).toBe("manual");
  });

  it("最新の投稿に感想や写真が無ければ、次の投稿から補う", () => {
    const spots = aggregateSpotCards([row("p2", "s1", { comment: "", post_photos: [] }), row("p1", "s1")]);
    expect(spots[0].latestComment).toBe("感想 p1");
    expect(spots[0].coverPath).toBe("p1.jpg");
    expect(spots[0].latestPostAt).toBe("2026-09-02T00:00:00Z");
  });
});

describe("sortSpotCards", () => {
  const spots = [
    { id: "a", latestPostAt: "2026-09-01T00:00:00Z", postCount: 5, ratingSum: 15, ratingCount: 5 }, // 平均 3
    { id: "b", latestPostAt: "2026-09-03T00:00:00Z", postCount: 1, ratingSum: 5, ratingCount: 1 }, // 平均 5
    { id: "c", latestPostAt: "2026-09-02T00:00:00Z", postCount: 2, ratingSum: 0, ratingCount: 0 }, // 評価なし
  ];
  it("新着順は最新の投稿日時の降順", () => {
    expect(sortSpotCards(spots, "newest").map((s) => s.id)).toEqual(["b", "c", "a"]);
  });
  it("評価順は★の平均の降順（評価なしは最後）、同点は新着順", () => {
    expect(sortSpotCards(spots, "rating").map((s) => s.id)).toEqual(["b", "a", "c"]);
  });
  it("投稿数順は件数の降順", () => {
    expect(sortSpotCards(spots, "count").map((s) => s.id)).toEqual(["a", "c", "b"]);
  });
});

describe("parseSpotSort", () => {
  it("newest/rating/count 以外（likes など）は新着順に倒す", () => {
    expect(parseSpotSort("count")).toBe("count");
    expect(parseSpotSort("likes")).toBe("newest");
    expect(parseSpotSort(null)).toBe("newest");
  });
});
