import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 出典: docs/tasks/notifications/notification-list/03-read-status-badge-sync.md 単体テスト
 * - 既読化APIが個人向け通知のみを対象とし、system_announcements 由来の項目には影響しないことを検証する
 */
const state = { user: { id: "me" } as { id: string } | null };
const touchedTables: string[] = [];
const inIds = vi.fn((_col: string, ids: string[]) => ({ select: async () => ({ data: ids.map((id) => ({ id })), error: null }) }));
const eqCalls: [string, unknown][] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user }, error: null }) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      touchedTables.push(table);
      return {
        update: () => ({
          eq: (col: string, value: unknown) => {
            eqCalls.push([col, value]);
            return {
              eq: (col2: string, value2: unknown) => {
                eqCalls.push([col2, value2]);
                return { in: inIds };
              },
            };
          },
        }),
      };
    },
  }),
}));

import { PATCH } from "./route";

const patch = (body: unknown) =>
  PATCH(new Request("http://localhost/api/notifications/read", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));

beforeEach(() => {
  state.user = { id: "me" };
  touchedTables.length = 0;
  eqCalls.length = 0;
  inIds.mockClear();
});

describe("PATCH /api/notifications/read", () => {
  it("notifications テーブルだけを、本人の未読分に限って既読化する", async () => {
    const response = await patch({ notificationIds: ["n1", "n2", "announcement-x"] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: 3 });
    expect(touchedTables).toEqual(["notifications"]);
    expect(touchedTables).not.toContain("system_announcements");
    expect(eqCalls).toEqual([
      ["user_id", "me"],
      ["is_read", false],
    ]);
    expect(inIds).toHaveBeenCalledWith("id", ["n1", "n2", "announcement-x"]);
  });

  it("IDが無ければ何もしない", async () => {
    const response = await patch({ notificationIds: [] });
    expect(await response.json()).toEqual({ updated: 0 });
    expect(touchedTables).toEqual([]);
  });

  it("未ログインは401", async () => {
    state.user = null;
    expect((await patch({ notificationIds: ["n1"] })).status).toBe(401);
  });
});
