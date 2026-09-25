import { describe, expect, it, vi } from "vitest";
import { buildMatrixRequest, fetchTravelMinutes, isRoutesApiMode, parseMatrixResponse } from "./routes";

/**
 * 出典: docs/tasks/map-search/travel-time/01-routes-api-client.md 単体テスト
 * - 車は DRIVE＋渋滞考慮、電車・バスは TRANSIT で乗ってよい種別を出し分ける
 * - 応答から目的地の順に分数を作る。経路なし・壊れた値は null
 * - 失敗・キー無しは例外にせず全部 null（呼び出し側が直線距離の計算に切り替える）
 */
const origin = { lat: 35.68, lng: 139.76 };
const destinations = [
  { lat: 35.69, lng: 139.76 },
  { lat: 35.7, lng: 139.77 },
];
const now = new Date("2026-09-25T10:00:00Z");

describe("routes（Routes API）", () => {
  it("徒歩・自転車は対象外、車・電車・バスが対象", () => {
    expect(isRoutesApiMode("walk")).toBe(false);
    expect(isRoutesApiMode("bicycle")).toBe(false);
    expect(isRoutesApiMode("car")).toBe(true);
    expect(isRoutesApiMode("train")).toBe(true);
    expect(isRoutesApiMode("bus")).toBe(true);
  });

  it("車は DRIVE＋渋滞考慮、電車は鉄道、バスはバスだけを許す", () => {
    const car = buildMatrixRequest(origin, destinations, "car", now);
    expect(car.travelMode).toBe("DRIVE");
    expect(car.routingPreference).toBe("TRAFFIC_AWARE");
    expect(car.departureTime).toBe(now.toISOString());
    expect((car.origins as unknown[]).length).toBe(1);
    expect((car.destinations as unknown[]).length).toBe(2);

    const train = buildMatrixRequest(origin, destinations, "train", now);
    expect(train.travelMode).toBe("TRANSIT");
    expect(train.transitPreferences).toEqual({ allowedTravelModes: ["TRAIN", "SUBWAY", "RAIL"] });
    expect(buildMatrixRequest(origin, destinations, "bus", now).transitPreferences).toEqual({ allowedTravelModes: ["BUS"] });
  });

  it("応答を目的地の順に並べ、経路なし・壊れた値は null にする", () => {
    const minutes = parseMatrixResponse(
      [
        { destinationIndex: 1, duration: "600s", condition: "ROUTE_EXISTS" },
        { destinationIndex: 0, duration: "90s", condition: "ROUTE_EXISTS" },
      ],
      2
    );
    expect(minutes).toEqual([2, 10]);
    expect(parseMatrixResponse([{ destinationIndex: 0, condition: "ROUTE_NOT_FOUND" }], 1)).toEqual([null]);
    expect(parseMatrixResponse([{ destinationIndex: 0, duration: "abc" }], 1)).toEqual([null]);
    expect(parseMatrixResponse([{ destinationIndex: 5, duration: "60s" }], 1)).toEqual([null]);
    // 0 秒でも「約 1 分」に切り上げる
    expect(parseMatrixResponse([{ destinationIndex: 0, duration: "0s" }], 1)).toEqual([1]);
  });

  it("キーが無い・通信が失敗・応答が配列でないときは全部 null（例外にしない）", async () => {
    const original = process.env.GOOGLE_ROUTES_API_KEY;
    delete process.env.GOOGLE_ROUTES_API_KEY;
    expect(await fetchTravelMinutes(origin, destinations, "car", now)).toEqual([null, null]);

    process.env.GOOGLE_ROUTES_API_KEY = "test-key";
    try {
      vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
      expect(await fetchTravelMinutes(origin, destinations, "car", now)).toEqual([null, null]);
      vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
      expect(await fetchTravelMinutes(origin, destinations, "car", now)).toEqual([null, null]);
      vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: 400 } })));
      expect(await fetchTravelMinutes(origin, destinations, "car", now)).toEqual([null, null]);
      vi.stubGlobal("fetch", vi.fn(async () => Response.json([{ destinationIndex: 0, duration: "300s", condition: "ROUTE_EXISTS" }])));
      expect(await fetchTravelMinutes(origin, destinations, "car", now)).toEqual([5, null]);
    } finally {
      vi.unstubAllGlobals();
      if (original === undefined) delete process.env.GOOGLE_ROUTES_API_KEY;
      else process.env.GOOGLE_ROUTES_API_KEY = original;
    }
  });
});
