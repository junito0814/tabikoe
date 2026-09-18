import { describe, expect, it } from "vitest";
import { haversineMeters, walkMinutes, walkMinutesBetween } from "./walk-minutes";

describe("walkMinutes", () => {
  it("80m/分で切り上げる", () => {
    expect(walkMinutes(80)).toBe(1);
    expect(walkMinutes(81)).toBe(2);
    expect(walkMinutes(640)).toBe(8);
    expect(walkMinutes(641)).toBe(9);
  });

  it("0m でも 1 分", () => {
    expect(walkMinutes(0)).toBe(1);
  });
});

describe("haversineMeters", () => {
  it("東京駅〜大阪駅はおよそ 400km", () => {
    const meters = haversineMeters({ lat: 35.6812, lng: 139.7671 }, { lat: 34.7025, lng: 135.4959 });
    expect(meters).toBeGreaterThan(395000);
    expect(meters).toBeLessThan(405000);
  });
});

describe("walkMinutesBetween", () => {
  it("現在地やスポット座標が無ければ null", () => {
    expect(walkMinutesBetween(null, { lat: 35, lng: 135 })).toBeNull();
    expect(walkMinutesBetween({ lat: 35, lng: 135 }, { lat: null, lng: null })).toBeNull();
  });

  it("座標があれば徒歩分", () => {
    expect(walkMinutesBetween({ lat: 35, lng: 135 }, { lat: 35, lng: 135 })).toBe(1);
  });
});
