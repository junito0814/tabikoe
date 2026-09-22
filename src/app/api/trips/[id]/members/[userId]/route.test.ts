import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimsResultOf } from "@/lib/auth/claims-result";

/**
 * 出典: docs/tasks/records/album-collaboration/05-member-role-management-handler.md 単体テスト
 * - オーナー以外からのリクエストが拒否されることを検証する
 * - オーナー自身を対象とした変更・削除リクエストが拒否されることを検証する
 * 出典: docs/tasks/records/album-collaboration/07-notification-integration.md 単体テスト
 * - 権限変更・削除で、通知作成関数が正しい type・related_id・通知先で呼ばれることを検証する
 */
const state = {
  user: { id: "me" } as { id: string } | null,
  myRole: "owner" as string | null,
  targetRole: "viewer" as string | null,
};

const update = vi.fn(() => ({ eq: () => ({ eq: async () => ({ error: null }) }) }));
const remove = vi.fn(() => ({ eq: () => ({ eq: async () => ({ error: null }) }) }));
const notificationInsert = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: async () => claimsResultOf(state.user) } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "notifications") return { insert: notificationInsert };
      if (table === "trips") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: "someone" }, error: null }) }) }) };
      }
      // album_members: select(...).eq(trip).eq(user).maybeSingle → 自分 or 対象
      return {
        update,
        delete: remove,
        select: () => ({
          eq: () => ({
            eq: (_col: string, userId: string) => ({
              maybeSingle: async () => ({
                data:
                  userId === "me"
                    ? state.myRole && { role: state.myRole }
                    : state.targetRole && { id: "m", role: state.targetRole },
                error: null,
              }),
            }),
          }),
        }),
      };
    },
  }),
}));

import { DELETE, PATCH } from "./route";

const params = (userId: string) => ({ params: Promise.resolve({ id: "trip-1", userId }) });
const patch = (userId: string, role = "editor") =>
  PATCH(
    new Request("http://localhost", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) }),
    params(userId)
  );
const del = (userId: string) => DELETE(new Request("http://localhost", { method: "DELETE" }), params(userId));

beforeEach(() => {
  state.user = { id: "me" };
  state.myRole = "owner";
  state.targetRole = "viewer";
  update.mockClear();
  remove.mockClear();
  notificationInsert.mockClear();
});

describe("PATCH/DELETE /api/trips/[id]/members/[userId]", () => {
  it("オーナーは権限を変更でき、対象へ role_change 通知が届く", async () => {
    const response = await patch("member-1", "editor");
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ role: "editor" });
    expect(notificationInsert).toHaveBeenCalledWith({ user_id: "member-1", type: "role_change", related_id: "trip-1", is_read: false });
  });

  it("オーナーはメンバーを削除でき、対象へ member_removed 通知が届く", async () => {
    expect((await del("member-1")).status).toBe(200);
    expect(remove).toHaveBeenCalled();
    expect(notificationInsert).toHaveBeenCalledWith({ user_id: "member-1", type: "member_removed", related_id: "trip-1", is_read: false });
  });

  it("オーナー以外（編集者）からの変更・削除は403", async () => {
    state.myRole = "editor";
    expect((await patch("member-1")).status).toBe(403);
    expect((await del("member-1")).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("メンバーでなければ404", async () => {
    state.myRole = null;
    expect((await patch("member-1")).status).toBe(404);
  });

  it("オーナー自身を対象にした変更・削除は400", async () => {
    expect((await patch("me")).status).toBe(400);
    expect((await del("me")).status).toBe(400);
    state.targetRole = "owner";
    expect((await del("other-owner")).status).toBe(400);
  });

  it("owner ロールへの変更は400", async () => {
    expect((await patch("member-1", "owner")).status).toBe(400);
  });

  it("未ログインは401", async () => {
    state.user = null;
    expect((await del("member-1")).status).toBe(401);
  });
});
