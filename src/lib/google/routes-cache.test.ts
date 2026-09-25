import { beforeEach, describe, expect, it, vi } from "vitest";
import { cacheKey, clearRoutesCache, getTravelMinutes, ROUTES_CACHE_TTL_MS, roundOrigin } from "./routes-cache";

/**
 * 出典: docs/tasks/map-search/travel-time/01-routes-api-client.md 単体テスト
 * - 現在地を約 100m 単位に丸め、同じ地点・同じ移動手段なら 10 分間は呼び直さない
 * - 徒歩・自転車は呼ばない
 */
const origin = { lat: 35.68123, lng: 139.76456 };
const destinations = [{ lat: 35.69, lng: 139.76 }];
const now = 1_000_000_000;

beforeEach(() => clearRoutesCache());

describe("routes-cache", () => {
  it("現在地を約 100m 単位に丸める", () => {
    expect(roundOrigin(origin)).toEqual({ lat: 35.681, lng: 139.765 });
    expect(cacheKey(origin, destinations, "car")).toBe(cacheKey({ lat: 35.6814, lng: 139.7646 }, destinations, "car"));
    expect(cacheKey(origin, destinations, "car")).not.toBe(cacheKey(origin, destinations, "train"));
  });

  it("徒歩・自転車では呼ばず、全部 null を返す", async () => {
    const fetcher = vi.fn();
    expect(await getTravelMinutes(origin, destinations, "walk", now, fetcher)).toEqual([null]);
    expect(await getTravelMinutes(origin, destinations, "bicycle", now, fetcher)).toEqual([null]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("10 分以内は呼び直さず、過ぎたら呼び直す", async () => {
    const fetcher = vi.fn(async () => [7]);
    expect(await getTravelMinutes(origin, destinations, "car", now, fetcher)).toEqual([7]);
    expect(await getTravelMinutes({ lat: 35.6814, lng: 139.7646 }, destinations, "car", now + 60_000, fetcher)).toEqual([7]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await getTravelMinutes(origin, destinations, "car", now + ROUTES_CACHE_TTL_MS, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("1 件も取れなかったときは覚えない（次の機会に試す）", async () => {
    const fetcher = vi.fn(async () => [null]);
    await getTravelMinutes(origin, destinations, "car", now, fetcher);
    await getTravelMinutes(origin, destinations, "car", now + 1000, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
