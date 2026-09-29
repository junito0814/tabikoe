import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { provisionallySuspend } from "./suspend";

/** 出典: docs/tasks/safety/strike-system/04-provisional-suspension.md 単体テスト */
function fakeAdmin(alreadySuspended: boolean) {
  const inserts: Record<string, unknown>[] = [];
  const updates: unknown[] = [];
  const client = {
    from: (table: string) => ({
      update: (payload: unknown) => {
        updates.push(payload);
        const c: Record<string, unknown> = {};
        c.eq = () => c;
        c.is = () => c;
        c.select = async () => ({ data: alreadySuspended ? [] : [{ id: "u1" }], error: null });
        return c;
      },
      select: () => {
        const c: Record<string, unknown> = {};
        c.eq = () => c;
        c.maybeSingle = async () => ({ data: { display_name: "けんじ" }, error: null });
        c.then = (resolve: (v: unknown) => void) => resolve({ data: table === "users" ? [{ id: "admin-1" }, { id: "admin-2" }] : [], error: null });
        return c;
      },
      insert: async (payload: Record<string, unknown>) => {
        inserts.push({ table, ...payload });
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient;
  return { client, inserts, updates };
}
const now = new Date("2026-09-27T00:00:00Z");

describe("provisionallySuspend", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("suspended_at と provisional を入れ、本人・管理者に通知し、「自動」の記録を残す", async () => {
    const { client, inserts, updates } = fakeAdmin(false);
    expect(await provisionallySuspend(client, { userId: "u1", reason: "有効なストライク 5", now })).toEqual({ suspended: true });
    expect(updates[0]).toEqual({ suspended_at: now.toISOString(), suspension_kind: "provisional" });
    const notifications = inserts.filter((i) => i.table === "notifications");
    expect(notifications.map((n) => [n.user_id, n.type])).toEqual([
      ["u1", "account_suspended"],
      ["admin-1", "admin_suspended"],
      ["admin-2", "admin_suspended"],
    ]);
    expect(inserts.find((i) => i.table === "admin_actions")).toMatchObject({ actor_id: null, action: "user_provisional_suspend", target_id: "u1", note: "有効なストライク 5" });
  });

  it("既に停止中なら何もしない（冪等）", async () => {
    const { client, inserts } = fakeAdmin(true);
    expect(await provisionallySuspend(client, { userId: "u1", reason: "x", now })).toEqual({ suspended: false });
    expect(inserts).toHaveLength(0);
  });
});
