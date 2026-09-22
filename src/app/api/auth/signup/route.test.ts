import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 出典: docs/tasks/account/signup-login/11-google-once-signup.md 単体テスト
 * - 401（未認証）／片方だけの同意は 400 で作らない／両方で作成して { href }／登録済みは作らず { href }
 */
const state = { user: { id: "u1", email: "a@b" } as { id: string; email: string } | null, existing: null as { id: string; is_admin: boolean } | null };
const ensureUserRecord = vi.fn(async () => {});
const recordOperation = vi.fn(async () => {});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user }, error: null }) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.existing, error: null }) }) }) }) }),
}));
vi.mock("@/lib/users/ensure-user-record", () => ({ ensureUserRecord: (...args: unknown[]) => ensureUserRecord(...(args as [])) }));
vi.mock("@/lib/logs/record-operation", () => ({ recordOperation: (...args: unknown[]) => recordOperation(...(args as [])) }));

import { POST } from "./route";

const post = (body: unknown) => POST(new Request("http://localhost/api/auth/signup", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }));

beforeEach(() => {
  state.user = { id: "u1", email: "a@b" };
  state.existing = null;
  ensureUserRecord.mockClear();
  recordOperation.mockClear();
});

describe("POST /api/auth/signup（同意してはじめる）", () => {
  it("両方に同意していれば作成して着地点を返す（元の遷移先があればそこ）", async () => {
    const response = await post({ terms: true, privacy: true, redirectTo: "/posts/new" });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ href: "/posts/new" });
    expect(ensureUserRecord).toHaveBeenCalledTimes(1);
    expect(recordOperation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actionType: "account_create" }));
  });

  it("片方だけ・未送信・文字列の true は同意なし（400）で作らない", async () => {
    for (const body of [{ terms: true }, { privacy: true }, {}, { terms: "true", privacy: "true" }]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(ensureUserRecord).not.toHaveBeenCalled();
  });

  it("登録済みなら作らず着地点だけ返す（同意日時は上書きしない）", async () => {
    state.existing = { id: "u1", is_admin: false };
    const response = await post({ terms: false, privacy: false });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ href: "/" });
    expect(ensureUserRecord).not.toHaveBeenCalled();
  });

  it("未認証は 401", async () => {
    state.user = null;
    expect((await post({ terms: true, privacy: true })).status).toBe(401);
  });

  it("外部 URL の redirectTo はホームに倒す", async () => {
    const response = await post({ terms: true, privacy: true, redirectTo: "https://evil.example" });
    expect(await response.json()).toEqual({ href: "/" });
  });
});
