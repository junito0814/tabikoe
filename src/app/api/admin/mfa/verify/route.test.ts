import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimsResultOf } from "@/lib/auth/claims-result";
import { ADMIN_MFA_VERIFIED_COOKIE } from "@/lib/admin/mfa-verified-cookie";
import type { Factor } from "@supabase/supabase-js";

/** 出典: docs/tasks/admin/admin-login/05-mfa-screen.md 単体テスト（6 桁の検証は必ずサーバーで行う） */
const state = {
  user: { id: "admin-1" } as { id: string } | null,
  isAdmin: true,
  all: [] as Factor[],
  totp: [] as Factor[],
  challengeError: null as Error | null,
  verifyError: null as Error | null,
};

const { challenge, verify } = vi.hoisted(() => ({ challenge: vi.fn(), verify: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () => claimsResultOf(state.user),
      mfa: {
        listFactors: async () => ({ data: { all: state.all, totp: state.totp }, error: null }),
        challenge: async (params: unknown) => {
          challenge(params);
          if (state.challengeError) return { data: null, error: state.challengeError };
          return { data: { id: "challenge-1" }, error: null };
        },
        verify: async (params: unknown) => {
          verify(params);
          return state.verifyError ? { data: null, error: state.verifyError } : { data: {}, error: null };
        },
      },
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_admin: state.isAdmin } }) }) }) }) }),
}));

import { POST } from "./route";

const factor = (id: string, status: "verified" | "unverified"): Factor =>
  ({ id, status, factor_type: "totp", friendly_name: "x", created_at: "", updated_at: "" }) as unknown as Factor;

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/admin/mfa/verify", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  state.user = { id: "admin-1" };
  state.isAdmin = true;
  state.totp = [factor("ok-1", "verified")];
  state.all = state.totp;
  state.challengeError = null;
  state.verifyError = null;
  challenge.mockClear();
  verify.mockClear();
});

describe("POST /api/admin/mfa/verify", () => {
  it("6 桁が合っていれば確認時刻の Cookie を書く", async () => {
    const res = await post({ code: "123456" });
    expect(res.status).toBe(200);
    expect(challenge).toHaveBeenCalledWith({ factorId: "ok-1" });
    expect(verify).toHaveBeenCalledWith({ factorId: "ok-1", challengeId: "challenge-1", code: "123456" });

    const cookie = res.cookies.get(ADMIN_MFA_VERIFIED_COOKIE);
    expect(cookie).toBeDefined();
    expect(Number(cookie!.value)).toBeGreaterThan(0);
    // ブラウザの JS から読めない・書けないこと
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe("lax");
  });

  it("空白・全角つきでも通す（正規化してから検証する）", async () => {
    await post({ code: "１２３ ４５６" });
    expect(verify).toHaveBeenCalledWith(expect.objectContaining({ code: "123456" }));
  });

  it("6 桁の形でなければ Supabase に問い合わせず 400", async () => {
    for (const code of ["12345", "1234567", "12a456", "", null]) {
      const res = await post({ code });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_code_format" });
    }
    expect(challenge).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it("番号が違えば 400 invalid_code を返し、Cookie は書かない", async () => {
    state.verifyError = new Error("invalid code");
    const res = await post({ code: "000000" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_code" });
    expect(res.cookies.get(ADMIN_MFA_VERIFIED_COOKIE)).toBeUndefined();
  });

  it("登録の確認では、渡された factorId（まだ未確認）を使う", async () => {
    state.totp = [];
    state.all = [factor("new-1", "unverified")];
    await post({ code: "123456", factorId: "new-1" });
    expect(verify).toHaveBeenCalledWith(expect.objectContaining({ factorId: "new-1" }));
  });

  it("自分が持っていない factorId は受け付けない", async () => {
    const res = await post({ code: "123456", factorId: "someone-else" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "factor_not_found" });
    expect(verify).not.toHaveBeenCalled();
  });

  it("認証アプリを 1 つも持っていなければ 409", async () => {
    state.totp = [];
    state.all = [];
    expect((await post({ code: "123456" })).status).toBe(409);
    expect(verify).not.toHaveBeenCalled();
  });

  it("一般利用者と未ログインは 404（この API の存在も見せない）", async () => {
    state.isAdmin = false;
    expect((await post({ code: "123456" })).status).toBe(404);
    state.isAdmin = true;
    state.user = null;
    expect((await post({ code: "123456" })).status).toBe(404);
    expect(verify).not.toHaveBeenCalled();
  });

  it("本文が JSON でなければ 400", async () => {
    const res = await POST(new Request("http://localhost/api/admin/mfa/verify", { method: "POST", body: "{" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_body" });
  });

  it("challenge に失敗したら 502 で、Cookie は書かない", async () => {
    state.challengeError = new Error("down");
    const res = await post({ code: "123456" });
    expect(res.status).toBe(502);
    expect(res.cookies.get(ADMIN_MFA_VERIFIED_COOKIE)).toBeUndefined();
    expect(verify).not.toHaveBeenCalled();
  });
});
