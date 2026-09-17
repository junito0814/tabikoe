/**
 * 出典: docs/tasks/posts/spot-selection-v3/03-spot-finalize-on-publish.md（単体テスト）
 * 「既存 50m 以内 → 既存 ID、無し → 新規作成、下書き → 作成しない、の 3 分岐」
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/google/geocoding", () => ({ reverseGeocodePrefecture: vi.fn(async () => "東京都") }));
vi.mock("./nearby", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./nearby")>();
  return { ...actual, findNearbySpots: vi.fn() };
});

import { findNearbySpots } from "./nearby";
import { finalizeSpotForPost, UNNAMED_SPOT_NAME } from "./finalize-spot";

function fakeAdmin(options: { existingById?: object | null; inserted?: object; updated?: object }) {
  const from = vi.fn((table: string) => {
    void table;
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn(async () => ({ data: options.existingById ?? null })) }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: vi.fn(async () => ({ data: options.inserted ?? null, error: options.inserted ? null : new Error("x") })) }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn(async () => ({ data: options.updated ?? null })) }) }),
      }),
    };
  });
  return { from } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("finalizeSpotForPost", () => {
  it("spotId があればそのスポットを返す", async () => {
    const admin = fakeAdmin({ existingById: { id: "s1", name: "A", lat: 1, lng: 2, prefecture: "東京都", source: "places" } });
    const result = await finalizeSpotForPost(admin, { spotId: "s1" });
    expect(result).toMatchObject({ ok: true, created: false, spot: { id: "s1" } });
  });

  it("50m 以内に既存があればそれに寄せる（新規作成しない）", async () => {
    vi.mocked(findNearbySpots).mockResolvedValueOnce([{ id: "near", name: "近く", lat: 1, lng: 2, prefecture: null, source: "manual", distance_meters: 10 }]);
    const admin = fakeAdmin({});
    const result = await finalizeSpotForPost(admin, { lat: 1, lng: 2, name: "無視される名前" });
    expect(result).toMatchObject({ ok: true, created: false, spot: { id: "near" } });
  });

  it("近くに無ければ manual で新規登録し、名前が空なら「名前のない場所」、都道府県を入れる", async () => {
    vi.mocked(findNearbySpots).mockResolvedValueOnce([]);
    const admin = fakeAdmin({
      inserted: { id: "new", name: UNNAMED_SPOT_NAME, lat: 1, lng: 2, prefecture: null, source: "manual" },
      updated: { id: "new", name: UNNAMED_SPOT_NAME, lat: 1, lng: 2, prefecture: "東京都", source: "manual" },
    });
    const result = await finalizeSpotForPost(admin, { lat: 1, lng: 2, name: "  " });
    expect(result).toMatchObject({ ok: true, created: true, spot: { id: "new", source: "manual", prefecture: "東京都" } });
  });
});
