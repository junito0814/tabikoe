import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimsResultOf } from "@/lib/auth/claims-result";

/** 出典: docs/tasks/admin/user-management/03-hidden-items.md 単体テスト（理由が空なら 400、一般利用者は 404、復元の呼び出し） */
const state = { user: { id: "admin-1" } as { id: string } | null, isAdmin: true };
const { restoreHiddenItem } = vi.hoisted(() => ({ restoreHiddenItem: vi.fn(async () => ({ restored: true, wasAuto: true })) }));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: async () => claimsResultOf(state.user) } }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_admin: state.isAdmin } }) }) }) }) }),
}));
vi.mock("@/lib/admin/hidden-items", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/admin/hidden-items")>()), restoreHiddenItem }));

import { POST } from "./route";
const post = (body: unknown) => POST(new Request("http://localhost/api/admin/hidden/restore", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  state.isAdmin = true;
  restoreHiddenItem.mockClear();
});

describe("POST /api/admin/hidden/restore", () => {
  it("理由が空なら 400、対象が不正なら 400", async () => {
    expect(await (await post({ kind: "post", id: "p1", note: "" })).json()).toEqual({ error: "note_required" });
    expect((await post({ kind: "photo", id: "p1", note: "x" })).status).toBe(400);
    expect(restoreHiddenItem).not.toHaveBeenCalled();
  });

  it("復元を呼び、結果を返す", async () => {
    const res = await post({ kind: "post", id: "p1", note: "問題なし" });
    expect(res.status).toBe(200);
    expect(restoreHiddenItem).toHaveBeenCalledWith(expect.anything(), { adminId: "admin-1", kind: "post", id: "p1", note: "問題なし" });
    expect(await res.json()).toEqual({ ok: true, restored: true, wasAuto: true });
  });

  it("一般利用者は 404", async () => {
    state.isAdmin = false;
    expect((await post({ kind: "post", id: "p1", note: "x" })).status).toBe(404);
  });
});
