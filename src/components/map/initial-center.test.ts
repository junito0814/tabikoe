import { describe, expect, it } from "vitest";
import { CURRENT_LOCATION_ZOOM, resolveInitialCenter, TOKYO_STATION } from "./initial-center";

/**
 * 出典: docs/tasks/map-search/map-display/03-map-screen-ui.md 単体テスト
 * - 位置情報許可／拒否それぞれのケースで、初期表示位置が正しく決定されることを検証する
 */
describe("resolveInitialCenter", () => {
  it("位置情報が許可されていれば現在地を初期表示位置にする", async () => {
    const geolocation = {
      getCurrentPosition: (success: PositionCallback) =>
        success({ coords: { latitude: 34.7, longitude: 135.5 } } as GeolocationPosition),
    };
    const result = await resolveInitialCenter(geolocation);
    expect(result).toEqual({
      center: { lat: 34.7, lng: 135.5 },
      zoom: CURRENT_LOCATION_ZOOM,
      source: "current",
    });
  });

  it("位置情報が拒否されたら東京駅周辺（35.6812, 139.7671）にする", async () => {
    const geolocation = {
      getCurrentPosition: (_success: PositionCallback, error?: PositionErrorCallback | null) =>
        error?.({ code: 1, message: "denied" } as GeolocationPositionError),
    };
    const result = await resolveInitialCenter(geolocation);
    expect(result.center).toEqual(TOKYO_STATION);
    expect(result.center).toEqual({ lat: 35.6812, lng: 139.7671 });
    expect(result.source).toBe("fallback");
  });

  it("位置情報APIが無い環境でも東京駅周辺にする", async () => {
    const result = await resolveInitialCenter(undefined);
    expect(result.center).toEqual(TOKYO_STATION);
  });
});
