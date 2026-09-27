import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { claimsResultOf } from "@/lib/auth/claims-result";

/**
 * 出典: docs/tasks/account/session-management/03-refresh-token-expiry-rule.md 単体テスト
 * - 最終利用が 30 日以内: 認証確認（getClaims）が行われ、締め出されない
 * - 最終利用が 30 日超: リフレッシュせずセッションを破棄し、redirect_to 付きでログイン画面へ（API は 401）
 */
const state = {
  user: { id: "u1" } as { id: string } | null,
  profile: { id: "u1", suspended_at: null } as { id: string; suspended_at: string | null } | null,
  // legal-documents Task 3: 公開中の版と本人の同意
  published: [] as { kind: string; version: string }[],
  consents: [] as { kind: string; version: string }[],
};
// performance Task1: 認証確認は getClaims（手元の署名検証）
const getClaims = vi.fn(async () => claimsResultOf(state.user));
const signOut = vi.fn(async () => ({ error: null }));
const rpc = vi.fn(async () => ({ error: null }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getClaims, signOut },
    rpc,
    from: (table: string) => ({
      select: () => ({
        eq: () => {
          const rows = table === "legal_documents" ? state.published : table === "user_consents" ? state.consents : [];
          return Object.assign(Promise.resolve({ data: rows, error: null }), {
            maybeSingle: async () => ({ data: state.profile, error: null }),
            single: async () => ({ data: { is_admin: false } }),
          });
        },
      }),
    }),
  }),
}));
vi.mock("@/lib/supabase/env", () => ({ assertSupabaseEnv: () => {} }));

import { proxy } from "./proxy";
import { resetPublishedVersionsCache } from "@/lib/legal/published-versions-cache";

const day = 24 * 60 * 60 * 1000;
const request = (path: string, cookies: Record<string, string>) =>
  new NextRequest(`http://localhost${path}`, {
    headers: { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ") },
  });
const session = { "sb-abc-auth-token": "token" };

beforeEach(() => {
  state.user = { id: "u1" };
  state.profile = { id: "u1", suspended_at: null };
  getClaims.mockClear();
  signOut.mockClear();
  rpc.mockClear();
  state.published = [];
  state.consents = [];
  resetPublishedVersionsCache();
});

describe("proxy（legal-documents Task 3: 新しい版に同意するまで止める）", () => {
  const cookie = "tabikoe-consented";

  it("未同意なら画面は同意画面へ（元の場所つき）、API は 401 reconsent_required", async () => {
    state.published = [{ kind: "terms", version: "1.2" }, { kind: "privacy", version: "1.0" }];
    state.consents = [{ kind: "terms", version: "1.1" }, { kind: "privacy", version: "1.0" }];
    const response = await proxy(request("/mypage", session));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname + new URL(response.headers.get("location")!).search).toBe("/consent/renew?redirect_to=%2Fmypage");
    const api = await proxy(request("/api/posts", session));
    expect(api.status).toBe(401);
    expect(await api.json()).toEqual({ error: "reconsent_required" });
    // 同意画面と規約の本文は通る
    expect((await proxy(request("/consent/renew", session))).status).toBe(200);
    expect((await proxy(request("/terms", session))).status).toBe(200);
  });

  it("同意済みなら通り、同意済みの印（Cookie）を書く。次からは Cookie が一致すれば DB を見ない", async () => {
    state.published = [{ kind: "terms", version: "1.2" }, { kind: "privacy", version: "1.0" }];
    state.consents = [{ kind: "terms", version: "1.2" }, { kind: "privacy", version: "1.0" }];
    const response = await proxy(request("/mypage", session));
    expect(response.status).toBe(200);
    expect(response.cookies.get(cookie)?.value).toBe("privacy:1.0|terms:1.2");
    // Cookie が一致していれば、同意が無くても（DB を見ないので）通る
    state.consents = [];
    expect((await proxy(request("/mypage", { ...session, [cookie]: "privacy:1.0|terms:1.2" }))).status).toBe(200);
  });

  it("公開中の版が無ければ何もしない", async () => {
    const response = await proxy(request("/mypage", session));
    expect(response.status).toBe(200);
    expect(response.cookies.get(cookie)).toBeUndefined();
  });
});

describe("proxy（admin-shell-dashboard Task 3: 最終利用日を 1 日 1 回だけ記録）", () => {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  it("今日の印が無ければ touch_last_active を呼び、今日の日付を Cookie に書く", async () => {
    const response = await proxy(request("/mypage", session));
    expect(rpc).toHaveBeenCalledWith("touch_last_active");
    const cookie = response.cookies.get("tabikoe-last-active-day");
    expect(cookie?.value).toBe(today);
    expect(cookie?.httpOnly).toBe(true);
  });

  it("同じ日の 2 回目は DB に触らない", async () => {
    const response = await proxy(request("/mypage", { ...session, "tabikoe-last-active-day": today }));
    expect(rpc).not.toHaveBeenCalled();
    expect(response.cookies.get("tabikoe-last-active-day")).toBeUndefined();
  });

  it("先読み（prefetch）と未ログインでは呼ばない", async () => {
    const prefetch = new NextRequest("http://localhost/mypage", { headers: { cookie: "sb-abc-auth-token=token", "next-router-prefetch": "1" } });
    await proxy(prefetch);
    state.user = null;
    await proxy(request("/", {}));
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("proxy（F-AC-02 Task3: 最終利用から 30 日で再ログイン）", () => {
  it("最終利用が 30 日以内なら認証確認（getClaims）が行われ、そのまま通る", async () => {
    const response = await proxy(request("/mypage", { ...session, "tabikoe-last-active": String(Date.now() - 10 * day) }));
    expect(response.status).toBe(200);
    expect(getClaims).toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("最終利用が 30 日を超えていればリフレッシュせずにセッションを破棄し、元の遷移先つきでログイン画面へ", async () => {
    const response = await proxy(request("/mypage", { ...session, "tabikoe-last-active": String(Date.now() - 31 * day) }));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname + new URL(response.headers.get("location")!).search).toBe("/login?error=expired&redirect_to=%2Fmypage");
    expect(getClaims).not.toHaveBeenCalled();
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

  describe("Task11: 認証済みだが未登録（登録待ち）", () => {
    it("他の画面を開くと同意画面（/signup）へ", async () => {
      state.profile = null;
      const response = await proxy(request("/mypage", session));
      expect(response.status).toBe(307);
      expect(new URL(response.headers.get("location")!).pathname).toBe("/signup");
    });

    it("認証以外の API は 401 signup_required", async () => {
      state.profile = null;
      const response = await proxy(request("/api/posts", session));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "signup_required" });
    });

    it("同意画面・ログイン画面・認証 API は通る", async () => {
      state.profile = null;
      for (const path of ["/signup", "/login", "/api/auth/signup"]) {
        expect((await proxy(request(path, session))).status).toBe(200);
      }
    });
  });

  describe("performance Task1: リンクの先読み（Next-Router-Prefetch）", () => {
    it("先読みでは認証確認だけ行い、users（一時停止・登録待ち）は引かない", async () => {
      state.profile = null; // 本来なら登録待ちとして /signup へ戻される状態
      const req = request("/mypage", session);
      req.headers.set("next-router-prefetch", "1");
      const response = await proxy(req);
      expect(response.status).toBe(200);
      expect(getClaims).toHaveBeenCalled();
    });
  });
});
