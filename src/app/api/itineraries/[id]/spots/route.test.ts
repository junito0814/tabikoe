import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 出典: docs/tasks/itinerary/add-spots/01-add-remove-spot-api.md 単体テスト
 * - 重複追加が冪等であること
 * - メンバー以外が 403（存在を知らせないため 404）になること
 */
const state = {
  role: "member" as string | null,
  existing: null as { id: string; spot_id: string; day_index: number | null; sort_order: number } | null,
  inserted: [] as Record<string, unknown>[],
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/auth/get-authenticated-user", () => ({ getAuthenticatedUser: async () => ({ id: "user-1" }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === "itinerary_members") return { data: state.role ? { role: state.role } : null, error: null };
          if (table === "spots") return { data: { id: "spot-1", hidden_at: null } };
          if (table === "itineraries") return { data: { start_date: "2026-09-20", end_date: "2026-09-22" } };
          if (table === "itinerary_spots") return { data: state.existing };
          return { data: null };
        },
        insert: (row: Record<string, unknown>) => {
          state.inserted.push(row);
          return { select: () => ({ single: async () => ({ data: { id: "is-new", ...row }, error: null }) }) };
        },
      };
      return chain;
    },
  }),
}));

import { POST } from "./route";

const params = Promise.resolve({ id: "it-1" });
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/itineraries/it-1/spots", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }), { params });

beforeEach(() => {
  state.role = "member";
  state.existing = null;
  state.inserted = [];
});

describe("POST /api/itineraries/[id]/spots", () => {
  it("メンバーは追加できる（期間外の Day は未定に丸める）", async () => {
    const response = await post({ spotId: "spot-1", dayIndex: 5 });
    expect(response.status).toBe(201);
    expect(state.inserted[0]).toMatchObject({ itinerary_id: "it-1", spot_id: "spot-1", day_index: null, sort_order: 0 });
  });

  it("既に入っていれば 200 で既存を返す（冪等）", async () => {
    state.existing = { id: "is-1", spot_id: "spot-1", day_index: 1, sort_order: 0 };
    const response = await post({ spotId: "spot-1" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ itinerarySpot: state.existing, alreadyAdded: true });
    expect(state.inserted).toEqual([]);
  });

  it("非メンバーは 404（存在を知らせない）", async () => {
    state.role = null;
    expect((await post({ spotId: "spot-1" })).status).toBe(404);
  });
});
