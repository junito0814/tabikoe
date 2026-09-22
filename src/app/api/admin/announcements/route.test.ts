import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimsResultOf } from "@/lib/auth/claims-result";

/**
 * 出典: docs/tasks/admin/announcement-management/02-announcement-crud-handler.md 単体テスト
 * - 正常系：タイトル・本文・公開日時を指定した作成リクエストで、レコードが正しく保存されることを検証する
 * - 異常系：タイトル101文字・本文2,001文字は拒否
 * - 編集・削除が指定したレコードにのみ作用することを検証する（id 条件で絞る）
 */
const state = { user: { id: "admin-1" } as { id: string } | null, isAdmin: true };

const insert = vi.fn((row: Record<string, unknown>) => ({
  select: () => ({ single: async () => ({ data: { id: "a1", ...row, created_at: "x", updated_at: "x" }, error: null }) }),
}));
const updateEq = vi.fn(() => ({
  select: () => ({ maybeSingle: async () => ({ data: { id: "a1" }, error: null }) }),
}));
const update = vi.fn(() => ({ eq: updateEq }));
const deleteEq = vi.fn(() => ({
  select: () => ({ maybeSingle: async () => ({ data: { id: "a1" }, error: null }) }),
}));
const remove = vi.fn(() => ({ eq: deleteEq }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: async () => claimsResultOf(state.user) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "users") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_admin: state.isAdmin } }) }) }) };
      }
      if (table === "operation_logs") return { insert: async () => ({ error: null }) };
      return { insert, update, delete: remove };
    },
  }),
}));

import { POST } from "./route";
import { DELETE, PATCH } from "./[id]/route";

const json = (body: unknown, method = "POST") =>
  new Request("http://localhost", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  state.user = { id: "admin-1" };
  state.isAdmin = true;
  insert.mockClear();
  updateEq.mockClear();
  deleteEq.mockClear();
});

describe("お知らせ API（管理者のみ）", () => {
  it("作成: タイトル・本文・公開日時を保存する（201）", async () => {
    const response = await POST(json({ title: "お知らせ", body: "本文", publishedAt: "2026-09-15T00:00:00Z" }));
    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({ title: "お知らせ", body: "本文", published_at: "2026-09-15T00:00:00.000Z" });
  });

  it("作成: タイトル101文字・本文2,001文字は400", async () => {
    expect((await POST(json({ title: "あ".repeat(101), body: "b" }))).status).toBe(400);
    expect((await POST(json({ title: "t", body: "あ".repeat(2001) }))).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("編集・削除は指定した id のレコードにのみ作用する", async () => {
    const params = { params: Promise.resolve({ id: "a1" }) };
    expect((await PATCH(json({ title: "t", body: "b" }, "PATCH"), params)).status).toBe(200);
    expect(updateEq).toHaveBeenCalledWith("id", "a1");
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), params)).status).toBe(200);
    expect(deleteEq).toHaveBeenCalledWith("id", "a1");
  });

  it("非管理者・未ログインは404（存在を伏せる）", async () => {
    state.isAdmin = false;
    expect((await POST(json({ title: "t", body: "b" }))).status).toBe(404);
    state.user = null;
    expect((await POST(json({ title: "t", body: "b" }))).status).toBe(404);
    expect(insert).not.toHaveBeenCalled();
  });
});
