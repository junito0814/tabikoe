import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimsResultOf } from "@/lib/auth/claims-result";
import type { Factor } from "@supabase/supabase-js";

/** 出典: docs/tasks/admin/admin-login/05-mfa-screen.md 単体テスト（登録の入口） */
const state = {
  user: { id: "admin-1" } as { id: string } | null,
  isAdmin: true,
  all: [] as Factor[],
  totp: [] as Factor[],
  listError: null as Error | null,
  enrollError: null as Error | null,
};

const { unenroll, enroll } = vi.hoisted(() => ({
  unenroll: vi.fn(async (params: { factorId: string }) => ({ data: null, error: null, params })),
  // 呼ばれた引数を見るだけの記録係（返り値は下の mock 側で組み立てる）
  enroll: vi.fn((params: unknown) => params),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () => claimsResultOf(state.user),
      mfa: {
        listFactors: async () =>
          state.listError ? { data: null, error: state.listError } : { data: { all: state.all, totp: state.totp }, error: null },
        unenroll,
        enroll: async (params: unknown) => {
          enroll(params);
          if (state.enrollError) return { data: null, error: state.enrollError };
          return {
            data: { id: "factor-new", type: "totp", totp: { qr_code: "<svg></svg>", secret: "JBSWY3DPEHPK3PXP", uri: "otpauth://x" } },
            error: null,
          };
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

beforeEach(() => {
  state.user = { id: "admin-1" };
  state.isAdmin = true;
  state.all = [];
  state.totp = [];
  state.listError = null;
  state.enrollError = null;
  unenroll.mockClear();
  enroll.mockClear();
});

describe("POST /api/admin/mfa/enroll", () => {
  it("QR コードと手入力用の文字列を返す", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      factorId: "factor-new",
      qrImageSrc: "data:image/svg+xml;utf8,%3Csvg%3E%3C%2Fsvg%3E",
      secret: "JBSW Y3DP EHPK 3PXP",
    });
  });

  it("途中でやめた登録（未確認の factor）を片付けてから始める", async () => {
    state.all = [factor("stale-1", "unverified"), factor("stale-2", "unverified")];
    await POST();
    expect(unenroll).toHaveBeenCalledTimes(2);
    expect(unenroll).toHaveBeenCalledWith({ factorId: "stale-1" });
    expect(enroll).toHaveBeenCalledWith({ factorType: "totp", friendlyName: "タビコエ管理", issuer: "タビコエ" });
  });

  it("すでに確認済みの認証アプリがあれば登録し直させない（消せる抜け道を作らない）", async () => {
    state.totp = [factor("ok-1", "verified")];
    state.all = state.totp;
    const res = await POST();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already_enrolled" });
    expect(unenroll).not.toHaveBeenCalled();
    expect(enroll).not.toHaveBeenCalled();
  });

  it("一般利用者と未ログインは 404（この API の存在も見せない）", async () => {
    state.isAdmin = false;
    expect((await POST()).status).toBe(404);
    state.isAdmin = true;
    state.user = null;
    expect((await POST()).status).toBe(404);
  });

  it("Supabase 側で失敗したら 502 を返し、登録を始めない", async () => {
    state.listError = new Error("down");
    expect((await POST()).status).toBe(502);
    expect(enroll).not.toHaveBeenCalled();

    state.listError = null;
    state.enrollError = new Error("down");
    const res = await POST();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "enroll_failed" });
  });
});
