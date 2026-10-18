import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimsResultOf } from "@/lib/auth/claims-result";

/**
 * 出典: docs/tasks/records/album-collaboration/02-invitation-issue-handler.md 単体テスト
 * - オーナー以外からのリクエストが拒否されることを検証する
 * - expires_at が発行時刻の7日後として正しく計算されることを検証する
 * 出典: docs/tasks/records/album-collaboration/03-invitation-revoke-handler.md 単体テスト
 * - オーナー以外からのリクエストが拒否されることを検証する
 */
const state = {
  user: { id: "me" } as { id: string } | null,
  myRole: "owner" as string | null,
  // #996: 回数の判定。true=枠内 / false=超えた / "unavailable"=数えられない
  rateLimit: true as boolean | "unavailable",
};

// #996: 回数を数えるのは DB の関数なので、ここでは差し替える（src/app/api/spots/[id]/status と同じ形）
vi.mock("@/lib/rate-limit/check-rate-limit", () => ({
  isWithinRateLimit: async () => {
    if (state.rateLimit === "unavailable") throw new Error("数えられない");
    return state.rateLimit;
  },
}));

const insert = vi.fn((row: Record<string, unknown>) => ({
  select: () => ({
    single: async () => ({
      data: { id: "inv-1", role: row.role, expires_at: row.expires_at, created_at: "2026-09-14T00:00:00Z" },
      error: null,
    }),
  }),
}));
const revokeUpdate = vi.fn(() => ({
  eq: () => ({ eq: () => ({ is: () => ({ select: () => ({ maybeSingle: async () => ({ data: { id: "inv-1" }, error: null }) }) }) }) }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: async () => claimsResultOf(state.user) } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "album_invitations") return { insert, update: revokeUpdate };
      if (table === "trips") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: "someone" }, error: null }) }) }) };
      }
      return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.myRole && { role: state.myRole }, error: null }) }) }) }),
      };
    },
  }),
}));

import { POST } from "./route";
import { DELETE } from "./[invitationId]/route";

const issue = (role = "viewer") =>
  POST(
    new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) }),
    { params: Promise.resolve({ id: "trip-1" }) }
  );
const revoke = () =>
  DELETE(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ id: "trip-1", invitationId: "inv-1" }) });

beforeEach(() => {
  state.user = { id: "me" };
  state.myRole = "owner";
  state.rateLimit = true;
  insert.mockClear();
  revokeUpdate.mockClear();
  vi.useRealTimers();
});

describe("POST /api/trips/[id]/invitations", () => {
  it("オーナーは招待を発行でき、expires_at は発行時刻の7日後", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T10:00:00Z"));
    const response = await issue("editor");
    expect(response.status).toBe(201);
    const inserted = insert.mock.calls[0][0];
    expect(inserted.expires_at).toBe("2026-09-21T10:00:00.000Z");
    expect(inserted.role).toBe("editor");
    expect(typeof inserted.token).toBe("string");
    const body = await response.json();
    expect(body.invitation.path).toMatch(/^\/invitations\/[A-Za-z0-9_-]{43}$/);
  });

  it("オーナー以外は403、メンバー外は404", async () => {
    state.myRole = "editor";
    expect((await issue()).status).toBe(403);
    state.myRole = null;
    expect((await issue()).status).toBe(404);
    expect(insert).not.toHaveBeenCalled();
  });

  it("owner ロールの招待は発行できない", async () => {
    expect((await issue("owner")).status).toBe(400);
  });

  /*
   * #996: 発行の回数を数える（1 ユーザーにつき 1 時間 10 件。要件 7.3）。
   *
   * 【初心者向け】数えること自体は DB の関数がやるので、ここでは
   * 「**超えたと言われたときに何もしないで断るか**」を見ます。
   */
  it("上限を超えたら 429 で、招待は作らない", async () => {
    state.rateLimit = false;
    const response = await issue();
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "rate_limited" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("回数を数えられないときは 503 で、招待は作らない", async () => {
    // 数えられないまま通すと、上限が無いのと同じになるため
    state.rateLimit = "unavailable";
    const response = await issue();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "rate_limit_unavailable" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("権限が足りないときは、回数を消費する前に断る", async () => {
    // 他人のアルバムへの試行で自分の枠が減らないこと（判定の順番）
    state.myRole = null;
    state.rateLimit = false;
    expect((await issue()).status).toBe(404);
  });
});

describe("DELETE /api/trips/[id]/invitations/[invitationId]", () => {
  it("オーナーは無効化できる（revoked_at を設定）", async () => {
    expect((await revoke()).status).toBe(200);
    expect(revokeUpdate).toHaveBeenCalledWith({ revoked_at: expect.any(String), status: "revoked" });
  });

  it("オーナー以外は403", async () => {
    state.myRole = "viewer";
    expect((await revoke()).status).toBe(403);
    expect(revokeUpdate).not.toHaveBeenCalled();
  });
});
