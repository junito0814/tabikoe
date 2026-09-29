import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { paginateHidden, parseHiddenTab, reasonFilterOf, restoreHiddenItem, type HiddenItem } from "./hidden-items";

/** 出典: docs/tasks/admin/user-management/03-hidden-items.md 単体テスト */
describe("タブと並び", () => {
  it("タブは hidden_reason で分かれ、管理者のタブは古い NULL も含む。不正な値は auto", () => {
    expect(reasonFilterOf("auto")).toBe("hidden_reason.eq.auto");
    expect(reasonFilterOf("suspension")).toBe("hidden_reason.eq.suspension");
    expect(reasonFilterOf("admin")).toBe("hidden_reason.is.null,hidden_reason.eq.moderation");
    expect(parseHiddenTab("admin")).toBe("admin");
    expect(parseHiddenTab("x")).toBe("auto");
  });

  it("非公開になった順に並べて 20 件ずつ", () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ kind: "post", id: `p${i}`, hiddenAt: `2026-09-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z` }) as HiddenItem);
    const page = paginateHidden(items, 0);
    expect(page.items).toHaveLength(20);
    expect(page.items[0].hiddenAt >= page.items[1].hiddenAt).toBe(true);
    expect(page.nextOffset).toBe(20);
    expect(paginateHidden(items, 20).nextOffset).toBeNull();
  });
});

function fakeAdmin(row: { hidden_at: string | null; hidden_reason: string | null } | null) {
  const calls: string[] = [];
  const client = {
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row ? { id: "x", ...row } : null, error: null }) }) }),
      update: (payload: Record<string, unknown>) => {
        const c: Record<string, unknown> = {};
        const filters: string[] = [];
        for (const f of ["eq", "in"]) c[f] = (...a: unknown[]) => { filters.push(`${f}:${a[0]}`); return c; };
        c.then = (resolve: (v: unknown) => void) => { calls.push(`${table}.update:${Object.keys(payload).join(",")}[${filters.join(",")}]`); resolve({ error: null }); };
        return c;
      },
      insert: async (payload: Record<string, unknown>) => { calls.push(`${table}.insert:${payload.action}`); return { error: null }; },
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("restoreHiddenItem", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("自動非公開の復元は公開に戻し、未処理の通報を「問題なし」にし、記録を残す", async () => {
    const { client, calls } = fakeAdmin({ hidden_at: "2026-09-26T00:00:00Z", hidden_reason: "auto" });
    const result = await restoreHiddenItem(client, { adminId: "admin-1", kind: "post", id: "p1", note: "問題なし" });
    expect(result).toEqual({ restored: true, wasAuto: true });
    // operation_logs（要件 7.5）への書き込みは recordAdminAction の中で行われるので除いて見る
    expect(calls.filter((c) => !c.startsWith("operation_logs."))).toEqual([
      "posts.update:hidden_at,hidden_reason[eq:id]",
      "reports.update:status,resolved_by,resolved_at,resolution_note[eq:target_id,in:target_type,in:status]",
      "admin_actions.insert:hidden_restore",
    ]);
  });

  it("管理者が非公開にしたものの復元は通報には触らない。隠れていなければ何もしない", async () => {
    const { client, calls } = fakeAdmin({ hidden_at: "2026-09-26T00:00:00Z", hidden_reason: "moderation" });
    expect(await restoreHiddenItem(client, { adminId: "admin-1", kind: "comment", id: "c1", note: "誤判定" })).toEqual({ restored: true, wasAuto: false });
    expect(calls.some((c) => c.startsWith("reports."))).toBe(false);
    const { client: c2, calls: calls2 } = fakeAdmin({ hidden_at: null, hidden_reason: null });
    expect(await restoreHiddenItem(c2, { adminId: "admin-1", kind: "post", id: "p1", note: "x" })).toEqual({ restored: false, wasAuto: false });
    expect(calls2).toEqual([]);
  });
});
