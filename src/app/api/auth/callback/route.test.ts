import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 出典: docs/tasks/account/signup-login/11-google-once-signup.md 単体テスト
 * - 未登録なら signOut せず（Google の認証状態を保持したまま）アカウントも作らずに /signup へ。redirect_to は引き継ぐ
 * - 登録済みなら着地点へ
 */
const state = { existingUser: null as { id: string; is_admin: boolean; suspended_at: string | null } | null };
const signOut = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: async () => ({ data: { user: { id: "u-new" } }, error: null }), signOut },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.existingUser, error: null }) }) }) }),
  }),
}));
vi.mock("@/lib/rate-limit/check-rate-limit", () => ({ isWithinRateLimit: async () => true }));
vi.mock("@/lib/logs/record-operation", () => ({ recordOperation: async () => {} }));

import { GET } from "./route";

const get = (query: string) => GET(new Request(`http://localhost/api/auth/callback?code=abc&${query}`));
const location = (response: Response) => response.headers.get("location")?.replace("http://localhost", "");

beforeEach(() => {
  state.existingUser = null;
  signOut.mockClear();
});

describe("GET /api/auth/callback（Task11: Google は 1 回）", () => {
  it("未登録なら認証状態を保持したまま同意画面（/signup）へ。アカウントは作らない", async () => {
    const response = await get("");
    expect(location(response)).toBe("/signup");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("未登録で redirect_to があれば同意画面に引き継ぐ", async () => {
    const response = await get("redirect_to=%2Fposts%2Fnew");
    expect(location(response)).toBe("/signup?redirect_to=%2Fposts%2Fnew");
  });

  it("登録済みなら通常のログインとして着地点へ", async () => {
    state.existingUser = { id: "u-new", is_admin: false, suspended_at: null };
    const response = await get("redirect_to=%2Fmypage");
    expect(location(response)).toBe("/mypage");
  });

  it("一時停止中なら signOut してログイン画面へ", async () => {
    state.existingUser = { id: "u-new", is_admin: false, suspended_at: "2026-09-01T00:00:00Z" };
    const response = await get("");
    expect(location(response)).toBe("/login?error=suspended");
    expect(signOut).toHaveBeenCalled();
  });
});
