/**
 * 出典: docs/tasks/map-search/search-top/01-suggest-api.md（単体テスト）
 * 「「おおさ」で 大阪府（都道府県）が先頭になり、合計が 8 件以下になること」「q が 1 文字では Places が呼ばれないこと」
 */
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/google/places", () => ({
  autocompleteRegions: vi.fn(async () => [{ placeId: "p1", name: "大阪駅", secondaryText: "大阪府大阪市北区", kind: "station" }]),
  PlacesApiError: class extends Error {},
}));
import { autocompleteRegions } from "@/lib/google/places";
import { mergeSuggestions, suggestDestinations, type DestinationSuggestion } from "./suggest-destinations";

function fakeAdmin(spots: { id: string; name: string; prefecture: string | null; posts: { count: number }[] }[]) {
  const query = { ilike: () => query, is: () => query, limit: async () => ({ data: spots, error: null }) };
  return { from: () => ({ select: () => query }) } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("suggestDestinations", () => {
  it("都道府県 → 駅 → スポットの順で、都道府県が先頭", async () => {
    const admin = fakeAdmin([{ id: "s1", name: "大阪城", prefecture: "大阪府", posts: [{ count: 3 }] }]);
    const result = await suggestDestinations(admin, "おおさ");
    expect(result.suggestions[0]).toMatchObject({ kind: "prefecture", name: "大阪府" });
    expect(result.suggestions.map((s) => s.kind)).toEqual(["prefecture", "station", "spot"]);
    expect(result.suggestions.length).toBeLessThanOrEqual(8);
  });
  it("1 文字では Places を呼ばない", async () => {
    vi.mocked(autocompleteRegions).mockClear();
    await suggestDestinations(fakeAdmin([]), "お");
    expect(autocompleteRegions).not.toHaveBeenCalled();
  });
});

describe("mergeSuggestions", () => {
  it("8 件で打ち切る", () => {
    const many: DestinationSuggestion[] = Array.from({ length: 10 }, (_, i) => ({ kind: "spot", name: `s${i}`, spotId: `${i}`, prefecture: null }));
    expect(mergeSuggestions(many)).toHaveLength(8);
  });
});
