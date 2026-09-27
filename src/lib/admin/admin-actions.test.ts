import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_ACTION_LABELS, ADMIN_ACTION_TYPES, parseAdminActionFilters, recordAdminAction } from "./admin-actions";

/** 出典: docs/tasks/admin/user-management/04-admin-actions-log.md 単体テスト */
function fakeAdmin() {
  const inserts: { table: string; payload: Record<string, unknown> }[] = [];
  const client = {
    from: (table: string) => ({
      insert: async (payload: Record<string, unknown>) => {
        inserts.push({ table, payload });
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient;
  return { client, inserts };
}

describe("recordAdminAction", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("admin_actions に 1 行作り、管理者の操作は operation_logs にも残す", async () => {
    const { client, inserts } = fakeAdmin();
    await recordAdminAction(client, {
      actorId: "admin-1",
      action: "report_hide",
      target: { type: "post", id: "p1", label: "投稿「たこ焼き」（はなこ）" },
      note: " 電話番号を含む ",
    });
    expect(inserts.map((i) => i.table)).toEqual(["admin_actions", "operation_logs"]);
    expect(inserts[0].payload).toEqual({
      actor_id: "admin-1",
      action: "report_hide",
      target_type: "post",
      target_id: "p1",
      target_label: "投稿「たこ焼き」（はなこ）",
      note: "電話番号を含む",
    });
  });

  it("actorId が無ければ「自動」として残し、operation_logs には残さない", async () => {
    const { client, inserts } = fakeAdmin();
    await recordAdminAction(client, { actorId: null, action: "auto_hide", target: { type: "post", id: "p1", label: "x" }, note: "異なる通報者 3 人" });
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload.actor_id).toBeNull();
  });

  it("書き込みに失敗しても例外を投げない", async () => {
    const client = { from: () => ({ insert: async () => { throw new Error("down"); } }) } as unknown as SupabaseClient;
    await expect(recordAdminAction(client, { actorId: null, action: "auto_hide" })).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("parseAdminActionFilters", () => {
  it("管理者 ID・自動・操作・期間を読み、不正な値は無視する", () => {
    const f = parseAdminActionFilters(
      new URLSearchParams({ actor: "11111111-2222-3333-4444-555555555555", action: "user_suspend", from: "2026-09-01", to: "2026-09-26" })
    );
    expect(f.actor).toBe("11111111-2222-3333-4444-555555555555");
    expect(f.action).toBe("user_suspend");
    expect(f.from).toBe(new Date("2026-09-01").toISOString());
    // 「まで」はその日いっぱい
    expect(new Date(f.to!).getTime()).toBeGreaterThan(new Date("2026-09-26").getTime());
    expect(parseAdminActionFilters(new URLSearchParams({ actor: "auto" })).actor).toBe("auto");
    expect(parseAdminActionFilters(new URLSearchParams({ actor: "x; drop", action: "nope", from: "??" }))).toEqual({
      actor: null,
      action: null,
      from: null,
      to: null,
    });
  });
});

describe("admin_actions のマイグレーション", () => {
  const sql = readFileSync("supabase/migrations/20260927000001_admin_actions.sql", "utf8");

  it("UPDATE・DELETE をどの役割にも許可せず、トリガーでも拒否する（消せない記録）", () => {
    expect(sql).toMatch(/revoke all privileges on table public\.admin_actions from anon, authenticated, service_role/);
    expect(sql).not.toMatch(/grant[^;]*\b(update|delete)\b[^;]*on table public\.admin_actions/i);
    expect(sql).toMatch(/grant select, insert on table public\.admin_actions to service_role/);
    expect(sql).toMatch(/before update or delete on public\.admin_actions/);
  });

  it("コードの操作の種類と CHECK 制約が一致している", () => {
    for (const type of ADMIN_ACTION_TYPES) {
      expect(sql).toContain(`'${type}'`);
      expect(ADMIN_ACTION_LABELS[type]).toBeTruthy();
    }
  });
});
