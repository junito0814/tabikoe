import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_MODERATION_SETTINGS as S } from "@/lib/moderation/strike-rules";
import { restrictionAfterRecount, suspendUser, unsuspendUser, validateActionNote } from "./user-actions";

/** 出典: docs/tasks/admin/user-management/02-user-detail-actions.md 単体テスト */
const now = new Date("2026-09-27T00:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
const strike = (createdDaysAgo: number, revoked = false) => ({
  createdAt: daysAgo(createdDaysAgo),
  expiresAt: new Date(now.getTime() + (90 - createdDaysAgo) * 86400000).toISOString(),
  revokedAt: revoked ? daysAgo(0) : null,
});

describe("validateActionNote", () => {
  it("空は note_required、長すぎは note_too_long、前後の空白は落とす", () => {
    expect(validateActionNote("")).toEqual({ ok: false, error: "note_required" });
    expect(validateActionNote("   ")).toEqual({ ok: false, error: "note_required" });
    expect(validateActionNote(" 誤判定 ")).toEqual({ ok: true, note: "誤判定" });
    expect(validateActionNote("a".repeat(1001))).toEqual({ ok: false, error: "note_too_long" });
  });
});

describe("restrictionAfterRecount（取り消し後の制限の決め直し）", () => {
  it("有効 2（新しい方が 1 日前）なら 1 日前＋3 日＝2 日後まで", () => {
    expect(restrictionAfterRecount([strike(10), strike(1)], S, now)).toBe(new Date(now.getTime() + 2 * 86400000).toISOString());
  });
  it("取り消しで有効 1 になれば制限なし、期間が過ぎていれば制限なし", () => {
    expect(restrictionAfterRecount([strike(10), strike(1, true)], S, now)).toBeNull();
    expect(restrictionAfterRecount([strike(10), strike(5)], S, now)).toBeNull(); // 5 日前 + 3 日 = 過去
  });
});

/** update/insert を記録する簡易クライアント */
function fakeAdmin() {
  const calls: string[] = [];
  const chain = (table: string, op: string) => {
    const c: Record<string, unknown> = {};
    const filters: string[] = [];
    for (const f of ["eq", "is"]) c[f] = (...a: unknown[]) => { filters.push(`${f}:${a.join("=")}`); return c; };
    c.select = () => { calls.push(`${table}.${op}[${filters.join(",")}]`); return Promise.resolve({ data: [{ id: "p1" }, { id: "p2" }], error: null }); };
    c.maybeSingle = async () => ({ data: { display_name: "じろう" }, error: null });
    c.then = (resolve: (v: unknown) => void) => { calls.push(`${table}.${op}[${filters.join(",")}]`); resolve({ data: null, error: null }); };
    return c;
  };
  const client = {
    from: (table: string) => ({
      update: (payload: Record<string, unknown>) => { calls.push(`${table}.update:${JSON.stringify(payload)}`); return chain(table, "update"); },
      select: () => chain(table, "select"),
      insert: async (payload: Record<string, unknown>) => { calls.push(`${table}.insert:${payload.type ?? payload.action}`); return { error: null }; },
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("suspendUser / unsuspendUser", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("停止は suspended_at と confirmed を入れ、既定で公開投稿を suspension として隠し、本人通知と記録を残す", async () => {
    const { client, calls } = fakeAdmin();
    const result = await suspendUser(client, { adminId: "admin-1", userId: "u1", note: "規約違反", hidePosts: true, now });
    expect(result.hiddenPosts).toBe(2);
    expect(calls[0]).toBe(`users.update:{"suspended_at":"${now.toISOString()}","suspension_kind":"confirmed"}`);
    expect(calls.some((c) => c.startsWith(`posts.update:{"hidden_at":"${now.toISOString()}","hidden_reason":"suspension"}`))).toBe(true);
    expect(calls).toContain("posts.update[eq:user_id=u1,eq:status=published,is:hidden_at=]"); // null は join で空になる
    expect(calls).toContain("notifications.insert:account_suspended");
    expect(calls).toContain("admin_actions.insert:user_suspend");
  });

  it("解除は停止で隠した投稿だけ戻す", async () => {
    const { client, calls } = fakeAdmin();
    const result = await unsuspendUser(client, { adminId: "admin-1", userId: "u1", note: "誤判定", restorePosts: true });
    expect(result.restoredPosts).toBe(2);
    expect(calls[0]).toBe('users.update:{"suspended_at":null,"suspension_kind":null}');
    expect(calls).toContain("posts.update[eq:user_id=u1,eq:hidden_reason=suspension]");
    expect(calls).toContain("notifications.insert:account_unsuspended");
    expect(calls).toContain("admin_actions.insert:user_unsuspend");
  });

  it("hidePosts=false なら投稿には触らない", async () => {
    const { client, calls } = fakeAdmin();
    await suspendUser(client, { adminId: "admin-1", userId: "u1", note: "x", hidePosts: false, now });
    expect(calls.some((c) => c.startsWith("posts."))).toBe(false);
  });
});
