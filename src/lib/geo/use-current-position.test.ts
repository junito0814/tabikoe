/**
 * 出典: docs/tasks/map-search/search-top/04-geolocation-hook.md（単体テスト）
 * 「navigator.geolocation をモックし、許可／拒否で戻り値が変わること」
 */
import { describe, expect, it } from "vitest";
import { requestCurrentPosition } from "./use-current-position";

describe("requestCurrentPosition", () => {
  it("許可されたら座標", async () => {
    const geo = { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition) };
    expect(await requestCurrentPosition(geo)).toEqual({ ok: true, lat: 1, lng: 2 });
  });
  it("拒否されたら denied", async () => {
    const geo = { getCurrentPosition: (_ok: PositionCallback, err?: PositionErrorCallback) => err?.({ code: 1 } as GeolocationPositionError) };
    expect(await requestCurrentPosition(geo)).toEqual({ ok: false, reason: "denied" });
  });
  it("未対応なら unsupported", async () => {
    expect(await requestCurrentPosition(undefined)).toEqual({ ok: false, reason: "unsupported" });
  });
});
