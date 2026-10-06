import { describe, expect, it } from "vitest";
import { aggregateNearbySpots, type NearbyPostForGrouping } from "./nearby-spots";

/**
 * 出典: Issue #769「「近くのスポット」のカードをスポット単位にする」
 *
 * 【初心者向け】見出しは「近くのスポット」なのに中身は投稿単位で、
 * 浅草寺に 3 件の投稿があれば**浅草寺のカードが 3 枚**並んでいた。
 * 渡す並びは「新しい順」が前提（いちばん新しい感想を素直に取るため）。
 */
const post = (overrides: Partial<NearbyPostForGrouping> = {}): NearbyPostForGrouping =>
  ({
    id: "p1",
    spotId: "s1",
    spotName: "浅草寺",
    commentExcerpt: null,
    thumbnailPath: null,
    rating: null,
    lat: 35.71,
    lng: 139.79,
    distanceMeters: 300,
    walkMinutes: 5,
    minutes: 5,
    mode: "walk",
    ...overrides,
  }) as NearbyPostForGrouping;

describe("aggregateNearbySpots（#769）", () => {
  it("同じスポットは 1 枚にまとまり、件数が入る", () => {
    const result = aggregateNearbySpots([post({ id: "p1" }), post({ id: "p2" }), post({ id: "p3" })], 20);
    expect(result).toHaveLength(1);
    expect(result[0].spotId).toBe("s1");
    expect(result[0].postCount).toBe(3);
  });

  it("★は平均（小数 1 桁）。評価の無い投稿は数えない", () => {
    const result = aggregateNearbySpots([post({ rating: 5 }), post({ rating: 4 }), post({ rating: null })], 20);
    expect(result[0].averageRating).toBe(4.5);
    expect(result[0].postCount).toBe(3); // 件数には入る
  });

  it("★が 1 つも無ければ null（0 と書かない）", () => {
    expect(aggregateNearbySpots([post({ rating: null })], 20)[0].averageRating).toBeNull();
  });

  it("割り切れない平均は小数 1 桁に丸める", () => {
    expect(aggregateNearbySpots([post({ rating: 5 }), post({ rating: 4 }), post({ rating: 4 })], 20)[0].averageRating).toBe(4.3);
  });

  it("感想と写真は、いちばん新しいもの（先頭）。空なら後ろの投稿から補う", () => {
    const result = aggregateNearbySpots(
      [post({ id: "p1", commentExcerpt: null, thumbnailPath: null }), post({ id: "p2", commentExcerpt: "よかった", thumbnailPath: "b.jpg" })],
      20
    );
    expect(result[0].latestComment).toBe("よかった");
    expect(result[0].thumbnailPath).toBe("b.jpg");
  });

  it("距離はいちばん近いもの。所要時間もそれに合わせる", () => {
    const result = aggregateNearbySpots([post({ distanceMeters: 500, minutes: 8, walkMinutes: 8 }), post({ distanceMeters: 120, minutes: 2, walkMinutes: 2 })], 20);
    expect(result[0].distanceMeters).toBe(120);
    expect(result[0].minutes).toBe(2);
  });

  it("違うスポットは別の 1 枚。並びは近い順", () => {
    const result = aggregateNearbySpots(
      [post({ spotId: "far", spotName: "遠い", distanceMeters: 900 }), post({ spotId: "near", spotName: "近い", distanceMeters: 100 })],
      20
    );
    expect(result.map((spot) => spot.spotId)).toEqual(["near", "far"]);
  });

  it("上限は「スポットの数」で数える（投稿の数ではない）", () => {
    // 同じスポットの投稿 5 件＋別のスポット 2 つ → 上限 2 なら 2 スポット
    const posts = [
      ...Array.from({ length: 5 }, (_, i) => post({ id: `p${i}`, spotId: "a", distanceMeters: 100 })),
      post({ spotId: "b", distanceMeters: 200 }),
      post({ spotId: "c", distanceMeters: 300 }),
    ];
    const result = aggregateNearbySpots(posts, 2);
    expect(result.map((spot) => spot.spotId)).toEqual(["a", "b"]);
    expect(result[0].postCount).toBe(5);
  });

  it("何も無ければ空", () => {
    expect(aggregateNearbySpots([], 20)).toEqual([]);
  });
});
