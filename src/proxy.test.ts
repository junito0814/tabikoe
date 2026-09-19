import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * 出典: docs/tasks/account/session-management/03-refresh-token-expiry-rule.md 単体テスト
 * - 最終利用が 30 日以内: リフレッシュ（getUser）が行われ、締め出されない
 * - 最終利用が 30 日超: リフレッシュせずセッションを破棄し、redirect_to 付きでログイン画面へ（API は 401）
 */
const state = { user: { id: "u1" } as { id: string } | null };
const getUser = vi.fn(async () => ({ data: { user: state.user }, error: null }));
const signOut = vi.fn(async () => ({ error: null }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser, signOut },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { suspended_at: null } }), single: async () => ({ data: { is_admin: false } }) }) }) }),
  }),
}));
vi.mock("@/lib/supabase/env", () => ({ assertSupabaseEnv: () => {} }));

import { proxy } from "./proxy";

const day = 24 * 60 * 60 * 1000;
const request = (path: string, cookies: Record<string, string>) =>
  new NextRequest(`http://localhost${path}`, {
    headers: { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ") },
  });
const session = { "sb-abc-auth-token": "token" };

beforeEach(() => {
  state.user = { id: "u1" };
  getUser.mockClear();
  signOut.mockClear();
});

describe("proxy（F-AC-02 Task3: 最終利用から 30 日で再ログイン）", () => {
  it("最終利用が 30 日以内ならリフレッシュ（getUser）が行われ、そのまま通る", async () => {
    const response = await proxy(request("/mypage", { ...session, "tabikoe-last-active": String(Date.now() - 10 * day) }));
    expect(response.status).toBe(200);
    expect(getUser).toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("最終利用が 30 日を超えていればリフレッシュせずにセッションを破棄し、元の遷移先つきでログイン画面へ", async () => {
    const response = await proxy(request("/mypage", { ...session, "tabikoe-last-active": String(Date.now() - 31 * day) }));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname + new URL(response.headers.get("location")!).search).toBe("/login?error=expired&redirect_to=%2Fmypage");
    expect(getUser).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalled();
    expect(response.cookies.get("tabikoe-last-active")?.value).toBe("");
  });

  it("API へのリクエストが 30 日超なら 401 session_expired", async () => {
    const response = await proxy(request("/api/posts", { ...session, "tabikoe-last-active": String(Date.now() - 31 * day) }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "session_expired" });
  });

  it("記録が無いログイン中のリクエストでは最終利用日時の Cookie を新しく書く（httpOnly）", async () => {
    const response = await proxy(request("/mypage", session));
    const cookie = response.cookies.get("tabikoe-last-active");
    expect(cookie?.value).toMatch(/^\d+$/);
    expect(cookie?.httpOnly).toBe(true);
  });

  it("1 時間以内に書いた記録は書き直さない", async () => {
    const response = await proxy(request("/mypage", { ...session, "tabikoe-last-active": String(Date.now() - 5 * 60 * 1000) }));
    expect(response.cookies.get("tabikoe-last-active")).toBeUndefined();
  });

  it("セッション Cookie が無ければ古い記録があっても締め出さず、記録を消す（次のログインに持ち越さない）", async () => {
    state.user = null;
    const response = await proxy(request("/login", { "tabikoe-last-active": String(Date.now() - 60 * day) }));
    expect(response.status).toBe(200);
    expect(signOut).not.toHaveBeenCalled();
    expect(response.cookies.get("tabikoe-last-active")?.value).toBe("");
  });
});
