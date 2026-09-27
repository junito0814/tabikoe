import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyAdmins } from "./notify-admins";

/** 出典: docs/tasks/admin/admin-shell-dashboard/04-admin-notifications.md 単体テスト */
function fakeAdmin(admins: string[]) {
  const inserted: Record<string, unknown>[] = [];
  const client = {
    from: (table: string) => {
      if (table === "users") {
        return { select: () => ({ eq: () => ({ eq: async () => ({ data: admins.map((id) => ({ id })), error: null }) }) }) };
      }
      return {
        insert: async (payload: Record<string, unknown>) => {
          inserted.push(payload);
          return { error: null };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, inserted };
}

describe("notifyAdmins", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("管理者が 2 人なら 2 件作られ、一般利用者には作られない", async () => {
    const { client, inserted } = fakeAdmin(["admin-1", "admin-2"]);
    const result = await notifyAdmins(client, { type: "admin_report", relatedId: "r1" });
    expect(result).toEqual({ created: 2, failed: 0 });
    expect(inserted.map((row) => row.user_id)).toEqual(["admin-1", "admin-2"]);
    expect(inserted[0]).toMatchObject({ type: "admin_report", related_id: "r1", is_read: false });
  });

  it("行為者が管理者本人なら自分には送らない（自分の通報を自分に知らせない）", async () => {
    const { client, inserted } = fakeAdmin(["admin-1", "admin-2"]);
    await notifyAdmins(client, { type: "admin_report", relatedId: "r1", actorId: "admin-1" });
    expect(inserted.map((row) => row.user_id)).toEqual(["admin-2"]);
  });

  it("管理者の取得に失敗しても例外を投げない", async () => {
    const client = { from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: null, error: { message: "down" } }) }) }) }) } as unknown as SupabaseClient;
    await expect(notifyAdmins(client, { type: "admin_suspended", relatedId: "u1" })).resolves.toEqual({ created: 0, failed: 1 });
  });
});
