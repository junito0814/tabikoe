import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { autoCheckItinerarySpots } from "./auto-check";

/**
 * 出典: docs/tasks/itinerary/itinerary-check/02-auto-check-on-publish.md 単体テスト
 * - メンバーの投稿でチェックされ、非メンバー（アルバムメンバー）の投稿では変わらないこと
 * - 既にチェック済みなら上書きしないこと（is("checked_at", null)）
 */
function fakeAdmin(options: { memberOfItinerary: boolean; updatedRows: number }) {
  const calls: { table: string; update?: unknown; filters: [string, unknown][] }[] = [];
  return {
    calls,
    admin: {
      from: (table: string) => {
        const call = { table, filters: [] as [string, unknown][] } as (typeof calls)[number];
        calls.push(call);
        const chain = {
          select: () => chain,
          eq: (column: string, value: unknown) => {
            call.filters.push([column, value]);
            return chain;
          },
          is: (column: string, value: unknown) => {
            call.filters.push([column, value]);
            return chain;
          },
          maybeSingle: async () => ({ data: options.memberOfItinerary ? { id: "it-1" } : null, error: null }),
          update: (values: unknown) => {
            call.update = values;
            return chain;
          },
          then: (resolve: (value: unknown) => void) => resolve({ data: Array.from({ length: options.updatedRows }, () => ({ id: "is" })), error: null }),
        };
        return chain;
      },
    } as unknown as SupabaseClient,
  };
}

describe("autoCheckItinerarySpots", () => {
  it("投稿者がメンバーのしおりに同じスポットがあればチェックする", async () => {
    const { admin, calls } = fakeAdmin({ memberOfItinerary: true, updatedRows: 1 });
    const count = await autoCheckItinerarySpots(admin, { userId: "u1", tripId: "trip-1", spotId: "spot-1" });
    expect(count).toBe(1);
    const update = calls.find((call) => call.table === "itinerary_spots");
    expect(update?.update).toMatchObject({ checked_by: "u1" });
    // 既にチェック済みの行は上書きしない
    expect(update?.filters).toContainEqual(["checked_at", null]);
    expect(update?.filters).toContainEqual(["spot_id", "spot-1"]);
  });

  it("投稿者がしおりのメンバーでなければ何もしない", async () => {
    const { admin, calls } = fakeAdmin({ memberOfItinerary: false, updatedRows: 0 });
    const count = await autoCheckItinerarySpots(admin, { userId: "album-member", tripId: "trip-1", spotId: "spot-1" });
    expect(count).toBe(0);
    expect(calls.some((call) => call.table === "itinerary_spots")).toBe(false);
  });
});
