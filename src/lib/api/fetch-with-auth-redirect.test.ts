import { describe, expect, it, vi } from "vitest";
import { fetchWithAuthRedirect, loginRedirectFor, UnauthorizedError } from "./fetch-with-auth-redirect";

/**
 * 出典: docs/tasks/account/session-management/05-frontend-seamless-session-ux.md 単体テスト
 *       #583（再同意・登録待ちの 401 をログイン画面に飛ばしていた不具合）
 */
describe("loginRedirectFor", () => {
  it("再同意待ちは同意の画面へ、登録待ちは同意画面へ、それ以外はログイン画面へ", () => {
    expect(loginRedirectFor("reconsent_required", "/terms")).toBe("/consent/renew");
    expect(loginRedirectFor("signup_required", "/terms")).toBe("/signup");
    expect(loginRedirectFor("session_expired", "/mypage")).toBe("/login?redirect_to=%2Fmypage");
    expect(loginRedirectFor(undefined, "/mypage")).toBe("/login?redirect_to=%2Fmypage");
  });
});

/** window.location.href への代入を記録する */
function stubLocation(pathname: string) {
  const location = { pathname, href: "" };
  vi.stubGlobal("window", { location });
  return location;
}

describe("fetchWithAuthRedirect", () => {
  it("401 reconsent_required では、ログインではなく再同意画面へ送る（#583）", async () => {
    const location = stubLocation("/terms");
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "reconsent_required" }), { status: 401 }));
    await expect(fetchWithAuthRedirect("/api/notifications/unread-count")).rejects.toBeInstanceOf(UnauthorizedError);
    expect(location.href).toBe("/consent/renew");
    vi.unstubAllGlobals();
  });

  it("本文が JSON でない 401 は、今までどおりログイン画面へ送る", async () => {
    const location = stubLocation("/mypage");
    vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));
    await expect(fetchWithAuthRedirect("/api/posts")).rejects.toBeInstanceOf(UnauthorizedError);
    expect(location.href).toBe("/login?redirect_to=%2Fmypage");
    vi.unstubAllGlobals();
  });

  it("401 以外はそのまま返す（本文を読めるまま渡す）", async () => {
    stubLocation("/mypage");
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const response = await fetchWithAuthRedirect("/api/posts");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    vi.unstubAllGlobals();
  });
});
