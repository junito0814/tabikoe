import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 出典: docs/tasks/records/album-collaboration/02-invitation-issue-handler.md 単体テスト
 * - オーナー以外からのリクエストが拒否されることを検証する
 * - expires_at が発行時刻の7日後として正しく計算されることを検証する
 * 出典: docs/tasks/records/album-collaboration/03-invitation-revoke-handler.md 単体テスト
 * - オーナー以外からのリクエストが拒否されることを検証する
 */
const state = { user: { id: "me" } as { id: string } | null, myRole: "owner" as string | null };

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
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user }, error: null }) } }),
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
});

describe("DELETE /api/trips/[id]/invitations/[invitationId]", () => {
  it("オーナーは無効化できる（revoked_at を設定）", async () => {
    expect((await revoke()).status).toBe(200);
    expect(revokeUpdate).toHaveBeenCalledWith({ revoked_at: expect.any(String) });
  });

  it("オーナー以外は403", async () => {
    state.myRole = "viewer";
    expect((await revoke()).status).toBe(403);
    expect(revokeUpdate).not.toHaveBeenCalled();
  });
});
