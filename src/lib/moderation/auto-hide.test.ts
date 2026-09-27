import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { autoHideTargetOf, evaluateAutoHide, restoreAutoHidden, summarizeReasons } from "./auto-hide";

/** 出典: docs/tasks/safety/strike-system/03-auto-hide.md 単体テスト */
function fakeAdmin(openReports: { reporter_id: string; reason: string }[], noIssue: { reporter_id: string }[], alreadyHidden = false) {
  const updates: { table: string; payload: unknown; filters: string[] }[] = [];
  const inserts: { table: string; payload: Record<string, unknown> }[] = [];
  const client = {
    from: (table: string) => ({
      select: (cols: string) => {
        const c: Record<string, unknown> = {};
        const filters: string[] = [];
        for (const f of ["eq", "in", "gte"]) c[f] = (...a: unknown[]) => { filters.push(`${f}:${a[0]}`); return c; };
        c.then = (resolve: (v: unknown) => void) => {
          if (table === "reports" && cols === "reporter_id, reason") return resolve({ data: openReports, error: null });
          if (table === "reports") return resolve({ data: noIssue, error: null });
          if (table === "users") return resolve({ data: [{ id: "admin-1" }], error: null });
          return resolve({ data: [], error: null });
        };
        return c;
      },
      update: (payload: unknown) => {
        const filters: string[] = [];
        const c: Record<string, unknown> = {};
        for (const f of ["eq", "is"]) c[f] = (...a: unknown[]) => { filters.push(`${f}:${a.join("=")}`); return c; };
        c.select = async () => { updates.push({ table, payload, filters }); return { data: alreadyHidden ? [] : [{ id: "p1" }], error: null }; };
        return c;
      },
      insert: async (payload: Record<string, unknown>) => { inserts.push({ table, payload }); return { error: null }; },
    }),
  } as unknown as SupabaseClient;
  return { client, updates, inserts };
}
const now = new Date("2026-09-27T00:00:00Z");

describe("evaluateAutoHide", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("異なる 3 人で hidden_at と hidden_reason=auto が入り、管理者通知と「自動」の記録が残る", async () => {
    const { client, updates, inserts } = fakeAdmin([{ reporter_id: "a", reason: "personal_info" }, { reporter_id: "b", reason: "personal_info" }, { reporter_id: "c", reason: "spam" }], []);
    const result = await evaluateAutoHide(client, { targetType: "post_review", targetId: "p1", now });
    expect(result).toEqual({ hidden: true, reporters: 3 });
    expect(updates[0]).toMatchObject({ table: "posts", payload: { hidden_at: now.toISOString(), hidden_reason: "auto" } });
    expect(updates[0].filters).toEqual(["eq:id=p1", "is:hidden_at="]);
    expect(inserts.map((i) => i.table)).toEqual(["notifications", "admin_actions"]);
    expect(inserts[0].payload).toMatchObject({ type: "admin_auto_hidden", related_id: "p1" });
    expect(inserts[1].payload).toMatchObject({ actor_id: null, action: "auto_hide", note: "異なる通報者 3 人（personal_info×2・spam×1）" });
  });

  it("同じ人が 3 回では隠さない", async () => {
    const { client, updates } = fakeAdmin([{ reporter_id: "a", reason: "spam" }, { reporter_id: "a", reason: "spam" }, { reporter_id: "a", reason: "spam" }], []);
    expect(await evaluateAutoHide(client, { targetType: "post", targetId: "p1", now })).toEqual({ hidden: false, reporters: 1 });
    expect(updates).toHaveLength(0);
  });

  it("「問題なし」が 3 件以上の通報者を除いて 2 人なら隠さない", async () => {
    const { client, updates } = fakeAdmin(
      [{ reporter_id: "a", reason: "spam" }, { reporter_id: "b", reason: "spam" }, { reporter_id: "c", reason: "spam" }],
      [{ reporter_id: "c" }, { reporter_id: "c" }, { reporter_id: "c" }]
    );
    expect(await evaluateAutoHide(client, { targetType: "comment", targetId: "c1", now })).toEqual({ hidden: false, reporters: 2 });
    expect(updates).toHaveLength(0);
  });

  it("既に隠れていれば通知も記録もしない。写真・ユーザー・スポットは対象外", async () => {
    const { client, inserts } = fakeAdmin([{ reporter_id: "a", reason: "spam" }, { reporter_id: "b", reason: "spam" }, { reporter_id: "c", reason: "spam" }], [], true);
    expect((await evaluateAutoHide(client, { targetType: "post", targetId: "p1", now })).hidden).toBe(false);
    expect(inserts).toHaveLength(0);
    expect(autoHideTargetOf("post_photo")).toBeNull();
    expect(autoHideTargetOf("user")).toBeNull();
    expect(autoHideTargetOf("spot")).toBeNull();
  });

  it("restoreAutoHidden は hidden_reason=auto の行だけ戻す", async () => {
    const { client, updates } = fakeAdmin([], []);
    expect(await restoreAutoHidden(client, "post", "p1")).toBe(true);
    expect(updates[0]).toMatchObject({ table: "posts", payload: { hidden_at: null, hidden_reason: null }, filters: ["eq:id=p1", "eq:hidden_reason=auto"] });
    expect(await restoreAutoHidden(client, "spot", "s1")).toBe(false);
  });

  it("summarizeReasons", () => {
    expect(summarizeReasons(["spam", "personal_info", "spam"])).toBe("spam×2・personal_info×1");
  });
});
