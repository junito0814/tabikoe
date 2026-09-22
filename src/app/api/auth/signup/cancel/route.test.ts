import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimsResultOf } from "@/lib/auth/claims-result";

/**
 * 出典: docs/tasks/account/signup-login/11-google-once-signup.md 単体テスト
 * - 登録待ち（users 行なし）なら Auth のユーザーを消してサインアウト。登録済みなら何もしない。未認証は正常終了
 */
const state = { user: { id: "u1" } as { id: string } | null, existing: null as { id: string } | null };
const signOut = vi.fn(async () => ({ error: null }));
const deleteUser = vi.fn(async () => ({ data: {}, error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: async () => claimsResultOf(state.user), signOut } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.existing, error: null }) }) }) }),
    auth: { admin: { deleteUser } },
  }),
}));

import { POST } from "./route";

beforeEach(() => {
  state.user = { id: "u1" };
  state.existing = null;
  signOut.mockClear();
  deleteUser.mockClear();
});

describe("POST /api/auth/signup/cancel（やめる）", () => {
  it("登録待ちなら Auth のユーザーを削除してサインアウト", async () => {
    const response = await POST();
    expect(await response.json()).toEqual({ ok: true, deleted: true });
    expect(deleteUser).toHaveBeenCalledWith("u1");
    expect(signOut).toHaveBeenCalled();
  });

  it("登録済みなら何もしない", async () => {
    state.existing = { id: "u1" };
    expect(await (await POST()).json()).toEqual({ ok: true, deleted: false });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("未認証でも正常終了", async () => {
    state.user = null;
    expect((await POST()).status).toBe(200);
  });
});
