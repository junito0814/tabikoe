import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 出典: docs/tasks/account/signup-login/07-consent-flow.md 単体テスト
 * - サーバー側で同意（利用規約・個人情報保護方針）のどちらかが欠けたら、ユーザー作成を実行せず SC-20 へ戻す
 * - 両方あれば作成して着地点（/）へ（ログイン画面を挟まない）
 * - ログイン画面から来た未登録者は作成せず SC-20 へ（account_not_found）
 */
const state = { existingUser: null as { id: string; is_admin: boolean; suspended_at: string | null } | null };
const ensureUserRecord = vi.fn(async () => {});
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
vi.mock("@/lib/users/ensure-user-record", () => ({ ensureUserRecord: (...args: unknown[]) => ensureUserRecord(...(args as [])) }));

import { GET } from "./route";

const get = (query: string) => GET(new Request(`http://localhost/api/auth/callback?code=abc&${query}`));
const location = (response: Response) => response.headers.get("location")?.replace("http://localhost", "");

beforeEach(() => {
  state.existingUser = null;
  ensureUserRecord.mockClear();
  signOut.mockClear();
});

describe("GET /api/auth/callback（同意フロー）", () => {
  it("Task10: 利用規約と個人情報保護方針の両方に同意していれば作成してホーム（/）へ", async () => {
    const response = await get("mode=signup&consent=1&terms=1&privacy=1");
    expect(ensureUserRecord).toHaveBeenCalledTimes(1);
    expect(location(response)).toBe("/");
  });

  it("Task10: どちらか一方だけ（旧 consent=1 だけも）なら作成せず、セッションを破棄して SC-20 へ", async () => {
    for (const query of ["mode=signup&consent=1&terms=1", "mode=signup&consent=1&privacy=1", "mode=signup&consent=1"]) {
      const response = await get(query);
      expect(location(response)).toBe("/signup?error=consent_required");
    }
    expect(ensureUserRecord).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledTimes(3);
  });

  it("ログイン画面から来た未登録者は作成せず SC-20 へ（account_not_found）", async () => {
    const response = await get("mode=login");
    expect(location(response)).toBe("/signup?error=account_not_found");
    expect(ensureUserRecord).not.toHaveBeenCalled();
  });

  it("登録済みならどちらの画面から来ても通常ログインとして着地点へ", async () => {
    state.existingUser = { id: "u-new", is_admin: false, suspended_at: null };
    const response = await get("mode=login&redirect_to=%2Fmypage");
    expect(location(response)).toBe("/mypage");
    expect(ensureUserRecord).not.toHaveBeenCalled();
  });
});
