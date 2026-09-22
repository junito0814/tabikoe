import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimsResultOf } from "@/lib/auth/claims-result";

/**
 * 出典: docs/tasks/records/album-collaboration/06-member-self-removal-handler.md 単体テスト
 * - role='owner' のユーザーからの退出リクエストが拒否されることを検証する
 */
const state = { user: { id: "me" } as { id: string } | null, myRole: "viewer" as string | null };
const remove = vi.fn(() => ({ eq: () => ({ eq: async () => ({ error: null }) }) }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: async () => claimsResultOf(state.user) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) =>
      table === "trips"
        ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: "someone" }, error: null }) }) }) }
        : {
            delete: remove,
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.myRole && { role: state.myRole }, error: null }) }) }) }),
          },
  }),
}));

import { DELETE } from "./route";
const leave = () => DELETE(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ id: "trip-1" }) });

beforeEach(() => {
  state.user = { id: "me" };
  state.myRole = "viewer";
  remove.mockClear();
});

describe("DELETE /api/trips/[id]/members/me", () => {
  it("閲覧者・編集者は退出できる", async () => {
    expect((await leave()).status).toBe(200);
    expect(remove).toHaveBeenCalled();
  });

  it("オーナーは退出できない（400）", async () => {
    state.myRole = "owner";
    const response = await leave();
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "owner_cannot_leave" });
    expect(remove).not.toHaveBeenCalled();
  });

  it("メンバーでなければ404", async () => {
    state.myRole = null;
    expect((await leave()).status).toBe(404);
  });
});
