import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyStrikeForReport } from "./apply-strike";

/** 出典: docs/tasks/safety/strike-system/02-strike-on-resolve.md 単体テスト */
const now = new Date("2026-09-27T00:00:00Z");

function fakeAdmin(existingStrikes: number, existingUntil: string | null = null) {
  const calls: { table: string; op: string; payload?: unknown }[] = [];
  const strikeRows = Array.from({ length: existingStrikes }, (_, i) => ({
    created_at: new Date(now.getTime() - (i + 1) * 86400000).toISOString(),
    expires_at: new Date(now.getTime() + 80 * 86400000).toISOString(),
    revoked_at: null,
  }));
  const client = {
    from: (table: string) => ({
      insert: (payload: unknown) => {
        calls.push({ table, op: "insert", payload });
        return { select: () => ({ single: async () => ({ data: { id: "s-new" }, error: null }) }) };
      },
      select: () => ({
        eq: () => {
          const rows = table === "strikes" ? [...strikeRows, { created_at: now.toISOString(), expires_at: "2099-01-01T00:00:00Z", revoked_at: null }] : [];
          return Object.assign(Promise.resolve({ data: table === "moderation_settings" ? [] : rows, error: null }), {
            maybeSingle: async () => ({ data: { posting_restricted_until: existingUntil }, error: null }),
          });
        },
        then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
      }),
      update: (payload: unknown) => {
        calls.push({ table, op: "update", payload });
        // 仮停止は update().eq().is().select() の形（suspend.ts）
        const c: Record<string, unknown> = { then: (resolve: (v: unknown) => void) => resolve({ error: null }) };
        c.eq = () => c;
        c.is = () => c;
        c.select = async () => ({ data: [{ id: "u1" }], error: null });
        return c;
      },
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

const input = { adminId: "admin-1", posterId: "u1", reportId: "r1", targetType: "post_review" as const, reason: "inappropriate" as const, action: "hide" as const, note: "不適切", now };

describe("applyStrikeForReport", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("1 つ目: ストライクを 1 行足し、警告どまり。本人に通知し、通報者は載せない", async () => {
    const { client, calls } = fakeAdmin(0);
    const result = await applyStrikeForReport(client, input);
    expect(result).toMatchObject({ strikeId: "s-new", activeCount: 1, measure: { kind: "warn" }, severe: false, postingRestrictedUntil: null });
    const strike = calls.find((c) => c.table === "strikes" && c.op === "insert")!.payload as Record<string, unknown>;
    expect(strike).toMatchObject({ user_id: "u1", report_id: "r1", reason: "inappropriate", action: "hide", target_label: "感想テキスト", created_by: "admin-1" });
    expect(strike.expires_at).toBe("2026-12-26T00:00:00.000Z");
    const notification = calls.find((c) => c.table === "notifications")!.payload as Record<string, unknown>;
    expect(notification).toMatchObject({ user_id: "u1", type: "moderation_action", related_id: "s-new" });
    expect(JSON.stringify(notification)).not.toContain("reporter");
    expect(calls.some((c) => c.table === "users" && c.op === "update")).toBe(false);
    expect(result.suspended).toBe(false);
  });

  it("2 つ目: 3 日間の投稿禁止になり、解除日時が users に入る", async () => {
    const { client, calls } = fakeAdmin(1);
    const result = await applyStrikeForReport(client, input);
    expect(result.activeCount).toBe(2);
    expect(result.measure).toEqual({ kind: "restrict", days: 3 });
    expect(result.postingRestrictedUntil).toBe("2026-09-30T00:00:00.000Z");
    expect(calls.find((c) => c.table === "users" && c.op === "update")!.payload).toEqual({ posting_restricted_until: "2026-09-30T00:00:00.000Z" });
  });

  it("既にもっと先まで止まっていれば縮めない", async () => {
    const { client } = fakeAdmin(1, "2026-10-15T00:00:00Z");
    const result = await applyStrikeForReport(client, input);
    expect(result.postingRestrictedUntil).toBe("2026-10-15T00:00:00Z");
  });

  it("5 つ目は suspend になり仮停止する。個人情報の掲載は 1 つ目でも severe で仮停止（Task 4）", async () => {
    const { client, calls } = fakeAdmin(4);
    const result = await applyStrikeForReport(client, input);
    expect(result.measure).toEqual({ kind: "suspend" });
    expect(result.suspended).toBe(true);
    expect(calls.find((c) => c.table === "users" && c.op === "update" && (c.payload as { suspension_kind?: string }).suspension_kind === "provisional")).toBeTruthy();
    expect(calls.filter((c) => c.table === "notifications").map((c) => (c.payload as { type: string }).type)).toContain("account_suspended");
    const { client: c2, calls: calls2 } = fakeAdmin(0);
    const severe = await applyStrikeForReport(c2, { ...input, reason: "personal_info" });
    expect(severe.severe).toBe(true);
    expect(severe.suspended).toBe(true);
    expect(calls2.find((c) => c.table === "admin_actions" && (c.payload as { action: string }).action === "user_provisional_suspend")).toBeTruthy();
  });
});
