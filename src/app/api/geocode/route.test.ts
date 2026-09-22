import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimsResultOf } from "@/lib/auth/claims-result";
import { GeocodingApiError } from "@/lib/google/geocoding";

/**
 * 出典: docs/tasks/map-search/place-search/01-geocode-handler.md 単体テスト
 * - APIエラー時に適切なエラーレスポンスを返すことを検証する
 */
const state = {
  user: { id: "me" } as { id: string } | null,
  result: { lat: 35.6812, lng: 139.7671, formattedAddress: "東京駅" } as unknown,
  throws: null as Error | null,
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => claimsResultOf(state.user) },
  }),
}));

vi.mock("@/lib/google/geocoding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/google/geocoding")>();
  return {
    ...actual,
    geocodePlace: async () => {
      if (state.throws) throw state.throws;
      return state.result;
    },
  };
});

import { GET } from "./route";

const get = (query: string) => GET(new Request(`http://localhost/api/geocode?query=${encodeURIComponent(query)}`));

beforeEach(() => {
  state.user = { id: "me" };
  state.result = { lat: 35.6812, lng: 139.7671, formattedAddress: "東京駅" };
  state.throws = null;
});

describe("GET /api/geocode", () => {
  it("緯度経度を返す", async () => {
    const response = await get("東京駅");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ place: { lat: 35.6812, lng: 139.7671, formattedAddress: "東京駅" } });
  });

  it("未ログインは401", async () => {
    state.user = null;
    expect((await get("東京駅")).status).toBe(401);
  });

  it("空の地名は400", async () => {
    expect((await get("   ")).status).toBe(400);
  });

  it("見つからなければ404", async () => {
    state.result = null;
    expect((await get("存在しない地名")).status).toBe(404);
  });

  it("Geocoding API の障害時は503", async () => {
    state.throws = new GeocodingApiError("down");
    const response = await get("東京駅");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "geocoding_unavailable" });
  });
});
