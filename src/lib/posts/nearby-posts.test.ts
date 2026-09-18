import { describe, expect, it } from "vitest";
import { DEFAULT_NEARBY_RADIUS, parseNearbyRadius, selectNearbyPosts } from "./nearby-posts";

/**
 * 出典: docs/tasks/browsing/explore-mode/01-nearby-posts-api.md 単体テスト
 * - 半径外が除外され、近い順に並ぶこと
 * - 既定半径が 1000 であること
 */
const center = { lat: 35.6812, lng: 139.7671 };
const row = (id: string, lat: number, lng: number) => ({
  id,
  spot_id: `s-${id}`,
  comment: "とても良かったです",
  spots: { id: `s-${id}`, name: `スポット${id}`, lat, lng },
  post_photos: [{ storage_url: `${id}.jpg`, display_order: 0 }],
});

describe("selectNearbyPosts", () => {
  it("半径外を除外し、近い順に並ぶ", () => {
    const rows = [
      row("far", 35.70, 139.7671), // 約 2km
      row("near", 35.6822, 139.7671), // 約 110m
      row("mid", 35.687, 139.7671), // 約 640m
    ];
    const result = selectNearbyPosts(rows, center, 1000);
    expect(result.map((post) => post.id)).toEqual(["near", "mid"]);
    expect(result[0].walkMinutes).toBe(2);
    expect(result[1].walkMinutes).toBe(9);
    expect(result[0].thumbnailPath).toBe("near.jpg");
  });

  it("上限件数で切る", () => {
    const rows = Array.from({ length: 30 }, (_, i) => row(String(i), 35.6812 + i * 0.00001, 139.7671));
    expect(selectNearbyPosts(rows, center, 1000, 20)).toHaveLength(20);
  });
});

describe("parseNearbyRadius", () => {
  it("既定は 1000、500/1000/3000 以外は既定", () => {
    expect(DEFAULT_NEARBY_RADIUS).toBe(1000);
    expect(parseNearbyRadius(null)).toBe(1000);
    expect(parseNearbyRadius("500")).toBe(500);
    expect(parseNearbyRadius("3000")).toBe(3000);
    expect(parseNearbyRadius("999")).toBe(1000);
  });
});
