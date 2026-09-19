import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 出典: docs/tasks/itinerary/itinerary-basics/01-itinerary-crud-api.md 単体テスト
 * - オーナー以外の作成が 403、2 つ目が 409 になること
 */
const state = {
  tripOwner: "user-1",
  existingItinerary: null as { id: string } | null,
  inserted: [] as Record<string, unknown>[],
  /** Bug #466: 旅行の取得が DB エラーで失敗する状況 */
  tripFetchError: null as { message: string } | null,
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/auth/get-authenticated-user", () => ({ getAuthenticatedUser: async () => ({ id: "user-1" }) }));
vi.mock("@/lib/trips/resolve-trip", async () => {
  const actual = await vi.importActual<typeof import("@/lib/trips/resolve-trip")>("@/lib/trips/resolve-trip");
  return { ...actual, resolveTripId: async () => "trip-1" };
});
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => {
          if (table === "trips") return state.tripFetchError ? { data: null, error: state.tripFetchError } : { data: { user_id: state.tripOwner } };
          if (table === "itineraries") return { data: state.existingItinerary };
          return { data: null };
        },
        insert: (row: Record<string, unknown>) => {
          state.inserted.push({ table, ...row });
          return { select: () => ({ single: async () => ({ data: { id: "it-new" }, error: null }) }) };
        },
      };
      return chain;
    },
  }),
}));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/itineraries", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }));

beforeEach(() => {
  state.tripOwner = "user-1";
  state.existingItinerary = null;
  state.inserted = [];
  state.tripFetchError = null;
});

describe("POST /api/itineraries", () => {
  it("旅行のオーナーなら作成でき、期間も保存される", async () => {
    const response = await post({ title: "大阪旅行", startDate: "2026-09-20", endDate: "2026-09-22" });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ itineraryId: "it-new", tripId: "trip-1" });
    expect(state.inserted).toEqual([{ table: "itineraries", trip_id: "trip-1", start_date: "2026-09-20", end_date: "2026-09-22" }]);
  });

  it("Bug #466: 旅行の取得が DB エラーなら 403 ではなく 500 fetch_failed", async () => {
    state.tripFetchError = { message: 'column trips.is_daily does not exist' };
    const response = await post({ title: "大阪旅行" });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "fetch_failed" });
    expect(state.inserted).toEqual([]);
  });

  it("旅行のオーナー以外は 403", async () => {
    state.tripOwner = "someone-else";
    expect((await post({ title: "大阪旅行" })).status).toBe(403);
    expect(state.inserted).toEqual([]);
  });

  it("同じ旅行に 2 つ目は 409", async () => {
    state.existingItinerary = { id: "it-1" };
    const response = await post({ title: "大阪旅行" });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "itinerary_exists", itineraryId: "it-1" });
  });

  it("期間が片方だけ・逆転は 400", async () => {
    expect((await post({ title: "大阪旅行", startDate: "2026-09-20" })).status).toBe(400);
    expect((await post({ title: "大阪旅行", startDate: "2026-09-22", endDate: "2026-09-20" })).status).toBe(400);
  });
});
