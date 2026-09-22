import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimsResultOf } from "@/lib/auth/claims-result";

/**
 * 出典: docs/tasks/records/wishlist/01-wishlist-toggle-handler.md 単体テスト
 * - 既に保存済みのスポットへの再保存リクエストが、エラーにならず冪等に処理されること
 *
 * Supabase クライアントは差し替え、Route Handler の分岐（認証・入力・スポット存在・一意制約）だけを検証する。
 */
const state = {
  user: { id: "me" } as { id: string } | null,
  spotExists: true,
  insertError: null as { code: string } | null,
};

const insert = vi.fn(async () => ({ error: state.insertError }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => claimsResultOf(state.user) },
    from: () => ({ insert }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: state.spotExists ? { id: "spot-1" } : null }),
        }),
      }),
    }),
  }),
}));

import { POST } from "./route";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  state.user = { id: "me" };
  state.spotExists = true;
  state.insertError = null;
  insert.mockClear();
});

describe("POST /api/wishlist", () => {
  it("初回保存は201で保存済みを返す", async () => {
    const response = await post({ spotId: "spot-1" });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ saved: true, alreadySaved: false });
    expect(insert).toHaveBeenCalledWith({ user_id: "me", spot_id: "spot-1" });
  });

  it("既に保存済み（一意制約違反 23505）でもエラーにせず200で冪等に返す", async () => {
    state.insertError = { code: "23505" };
    const response = await post({ spotId: "spot-1" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true, alreadySaved: true });
  });

  it("未ログインは401", async () => {
    state.user = null;
    expect((await post({ spotId: "spot-1" })).status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it("spotId が無ければ400", async () => {
    expect((await post({})).status).toBe(400);
  });

  it("登録されていないスポットは404", async () => {
    state.spotExists = false;
    expect((await post({ spotId: "missing" })).status).toBe(404);
    expect(insert).not.toHaveBeenCalled();
  });

  it("その他のDBエラーは500", async () => {
    state.insertError = { code: "42501" };
    expect((await post({ spotId: "spot-1" })).status).toBe(500);
  });
});
