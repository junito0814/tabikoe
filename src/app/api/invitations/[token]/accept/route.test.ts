import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimsResultOf } from "@/lib/auth/claims-result";

/**
 * 出典: docs/tasks/records/album-collaboration/04-invitation-acceptance-handler.md 単体テスト
 * - 期限切れ・無効化済みトークンでの受諾が拒否されることを検証する
 * - 既存メンバーが同じ招待を再度開いても重複登録されないことを検証する
 * 出典: docs/tasks/records/album-collaboration/07-notification-integration.md 単体テスト
 * - 参加時に、本人・オーナー・既存メンバー全員へ album_join 通知が作られることを検証する
 */
const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
const past = new Date(Date.now() - 60 * 1000).toISOString();

const state = {
  user: { id: "me" } as { id: string } | null,
  invitation: { id: "inv", trip_id: "trip-1", role: "viewer", expires_at: future, revoked_at: null as string | null } as Record<string, unknown> | null,
  existingRole: null as string | null,
};

const insert = vi.fn(async () => ({ error: null }));
const notificationInsert = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: async () => claimsResultOf(state.user) } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "notifications") return { insert: notificationInsert };
      if (table === "album_invitations") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.invitation, error: null }) }) }) };
      }
      // album_members
      return {
        insert,
        select: () => ({
          eq: () => {
            const afterTrip = {
              // .eq(user).maybeSingle → 既存メンバー判定
              eq: () => ({ maybeSingle: async () => ({ data: state.existingRole && { role: state.existingRole }, error: null }) }),
              // await → メンバー一覧（通知先）
              then: (resolve: (v: unknown) => void) =>
                resolve({ data: [{ user_id: "owner" }, { user_id: "existing" }, { user_id: "me" }], error: null }),
            };
            return afterTrip;
          },
        }),
      };
    },
  }),
}));

import { POST } from "./route";

const accept = () =>
  POST(new Request("http://localhost/api/invitations/tok/accept", { method: "POST" }), {
    params: Promise.resolve({ token: "tok" }),
  });

beforeEach(() => {
  state.user = { id: "me" };
  state.invitation = { id: "inv", trip_id: "trip-1", role: "viewer", expires_at: future, revoked_at: null };
  state.existingRole = null;
  insert.mockClear();
  notificationInsert.mockClear();
});

describe("POST /api/invitations/[token]/accept", () => {
  it("有効な招待なら指定ロールでメンバーに加わり、本人・オーナー・既存メンバーへ通知する", async () => {
    const response = await accept();
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ tripId: "trip-1", role: "viewer", alreadyMember: false });
    expect(insert).toHaveBeenCalledWith({ trip_id: "trip-1", user_id: "me", role: "viewer" });
    const recipients = notificationInsert.mock.calls.map((call) => (call as unknown as [{ user_id: string; type: string; related_id: string }])[0]);
    expect(recipients.map((r) => r.user_id).sort()).toEqual(["existing", "me", "owner"]);
    expect(recipients.every((r) => r.type === "album_join" && r.related_id === "trip-1")).toBe(true);
  });

  it("期限切れの招待は410", async () => {
    state.invitation = { ...state.invitation!, expires_at: past };
    const response = await accept();
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "invitation_expired" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("無効化済みの招待は410", async () => {
    state.invitation = { ...state.invitation!, revoked_at: past };
    const response = await accept();
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "invitation_revoked" });
  });

  it("既にメンバーなら重複登録せず、既存ロールを維持する", async () => {
    state.existingRole = "editor";
    const response = await accept();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tripId: "trip-1", role: "editor", alreadyMember: true });
    expect(insert).not.toHaveBeenCalled();
    expect(notificationInsert).not.toHaveBeenCalled();
  });

  it("存在しないトークンは404、未ログインは401", async () => {
    state.invitation = null;
    expect((await accept()).status).toBe(404);
    state.user = null;
    expect((await accept()).status).toBe(401);
  });
});
