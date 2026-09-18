/**
 * 出典: docs/tasks/posts/spot-selection-v3/02-resolve-spot-by-location.md（単体テスト）
 * 「50m 以内に候補があればそれを、無ければ null を返すこと（距離計算をモック）」
 */
import { describe, expect, it, vi } from "vitest";
vi.mock("./nearby", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./nearby")>();
  return { ...actual, findNearbySpots: vi.fn() };
});
import { findNearbySpots } from "./nearby";
import { parseLatLng, resolveSpotByLocation } from "./resolve-by-location";

const admin = {} as import("@supabase/supabase-js").SupabaseClient;

describe("resolveSpotByLocation", () => {
  it("候補が無ければ null", async () => {
    vi.mocked(findNearbySpots).mockResolvedValueOnce([]);
    expect(await resolveSpotByLocation(admin, 1, 2)).toBeNull();
  });
  it("複数あれば最も近い 1 件", async () => {
    vi.mocked(findNearbySpots).mockResolvedValueOnce([
      { id: "a", name: "A", lat: 1, lng: 2, prefecture: null, source: "manual", distance_meters: 40 },
      { id: "b", name: "B", lat: 1, lng: 2, prefecture: null, source: "places", distance_meters: 12 },
    ]);
    expect((await resolveSpotByLocation(admin, 1, 2))?.id).toBe("b");
  });
});

describe("parseLatLng", () => {
  it("範囲内の数値だけを受け付ける", () => {
    expect(parseLatLng(new URLSearchParams("lat=35.6&lng=139.7"))).toEqual({ lat: 35.6, lng: 139.7 });
    expect(parseLatLng(new URLSearchParams("lat=abc&lng=139.7"))).toBeNull();
    expect(parseLatLng(new URLSearchParams("lat=95&lng=139.7"))).toBeNull();
  });
});
