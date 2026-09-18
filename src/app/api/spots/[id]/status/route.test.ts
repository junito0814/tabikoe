import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 出典: docs/tasks/browsing/spot-status-report/01-report-api.md 単体テスト
 * - 2 回目の報告が上書きになること（モック: upsert が onConflict 付きで呼ばれる）
 * - 不正な status が 400 になること
 */
const upsert = vi.fn(async () => ({ error: null }));
const state = { rateLimitAllowed: true };

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/auth/get-authenticated-user", () => ({ getAuthenticatedUser: async () => ({ id: "user-1" }) }));
vi.mock("@/lib/rate-limit/check-rate-limit", () => ({ isWithinRateLimit: async () => state.rateLimitAllowed }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => {
          if (table === "spots") return { data: { id: "spot-1", hidden_at: null } };
          if (table === "spot_latest_status") return { data: { status: "still_there", reported_at: "2026-09-01T00:00:00Z" }, error: null };
          return { data: { status: "still_there", reported_at: "2026-09-01T00:00:00Z" }, error: null };
        },
        upsert,
      };
      return chain;
    },
  }),
}));

import { PUT } from "./route";

const params = Promise.resolve({ id: "spot-1" });
const put = (body: unknown) =>
  PUT(new Request("http://localhost/api/spots/spot-1/status", { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }), { params });

beforeEach(() => {
  upsert.mockClear();
  state.rateLimitAllowed = true;
});

describe("PUT /api/spots/[id]/status", () => {
  it("報告は (spot_id, user_id) をキーに UPSERT する（2 回目は上書き）", async () => {
    await put({ status: "still_there" });
    const response = await put({ status: "gone" });
    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenLastCalledWith(expect.objectContaining({ spot_id: "spot-1", user_id: "user-1", status: "gone" }), { onConflict: "spot_id,user_id" });
    expect(await response.json()).toEqual({
      latest: { status: "still_there", reportedAt: "2026-09-01T00:00:00Z" },
      mine: { status: "still_there", reportedAt: "2026-09-01T00:00:00Z" },
    });
  });

  it("不正な status は 400", async () => {
    const response = await put({ status: "maybe" });
    expect(response.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("レート制限に達したら 429", async () => {
    state.rateLimitAllowed = false;
    expect((await put({ status: "gone" })).status).toBe(429);
  });
});
