import { describe, expect, it } from "vitest";
import { nearbyPinFrom } from "./MapScreen";
import type { MapPinData } from "@/lib/map/get-map-pins";
import type { NearbySpot } from "@/lib/posts/nearby-spots";

/**
 * 出典: Issue #781「Bug 2: 地図の吹き出しに違う件数が出る（「1件」）」
 *
 * 【初心者向け】カードから吹き出しを出すとき、その範囲のピンをまだ取れていないことがある。
 * 以前はそこで仮の `postCount: 1` を入れていたので、投稿が 3 件のスポットでも「1件」と嘘が出ていた。
 */
const post = { spotId: "s1", spotName: "浅草寺", lat: 35.71, lng: 139.79 } as unknown as NearbySpot;

const pin = (overrides: Partial<MapPinData> = {}): MapPinData => ({
  id: "s1",
  spotId: "s1",
  name: "浅草寺",
  lat: 35.71,
  lng: 139.79,
  kind: "post",
  category: "観光",
  prefecture: "東京都",
  postCount: 3,
  ratingAverage: 4.2,
  latestStatus: null,
  draftId: null,
  ...overrides,
}) as MapPinData;

describe("nearbyPinFrom（#781）", () => {
  it("ピンの情報があれば、そのまま使う（件数も★も本当の値）", () => {
    const result = nearbyPinFrom(post, [pin()]);
    expect(result.postCount).toBe(3);
    expect(result.ratingAverage).toBe(4.2);
    expect(result.category).toBe("観光");
  });

  it("ピンの情報が無ければ、件数も★も「分からない」（null）にする ── 仮の値を入れない", () => {
    const result = nearbyPinFrom(post, []);
    expect(result.postCount).toBeNull();
    expect(result.ratingAverage).toBeNull();
    expect(result.category).toBeNull();
  });

  it("ピンの情報が無くても、スポット名と場所は出せる", () => {
    const result = nearbyPinFrom(post, []);
    expect(result.name).toBe("浅草寺");
    expect(result.spotId).toBe("s1");
    expect(result.lat).toBe(35.71);
  });

  it("別のスポットのピンしか無ければ「分からない」側", () => {
    const result = nearbyPinFrom(post, [pin({ id: "s2", spotId: "s2" })]);
    expect(result.postCount).toBeNull();
  });
});
