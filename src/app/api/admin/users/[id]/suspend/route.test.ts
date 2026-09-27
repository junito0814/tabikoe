import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimsResultOf } from "@/lib/auth/claims-result";

/** 出典: docs/tasks/admin/user-management/02-user-detail-actions.md 単体テスト（理由が空だと停止できない・既定で公開投稿を隠す） */
const state = { user: { id: "admin-1" } as { id: string } | null, isAdmin: true };
// vi.mock は先頭に巻き上げられるので、モック関数は vi.hoisted で先に作る
const { suspendUser } = vi.hoisted(() => ({ suspendUser: vi.fn(async () => ({ hiddenPosts: 2 })) }));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: async () => claimsResultOf(state.user) } }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: (cols: string) => ({ eq: () => ({ maybeSingle: async () => ({ data: cols === "is_admin" ? { is_admin: state.isAdmin } : { id: "u1" } }) }) }) }),
  }),
}));
vi.mock("@/lib/admin/user-actions", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/admin/user-actions")>()), suspendUser }));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/admin/users/u1/suspend", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: "u1" }) });

beforeEach(() => {
  state.isAdmin = true;
  suspendUser.mockClear();
});

describe("POST /api/admin/users/[id]/suspend", () => {
  it("理由が空なら 400 note_required で、停止しない", async () => {
    const res = await post({ note: " " });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "note_required" });
    expect(suspendUser).not.toHaveBeenCalled();
  });

  it("hidePosts を省くと既定 true で公開投稿をまとめて非公開にする", async () => {
    const res = await post({ note: "規約違反" });
    expect(res.status).toBe(200);
    expect(suspendUser).toHaveBeenCalledWith(expect.anything(), { adminId: "admin-1", userId: "u1", note: "規約違反", hidePosts: true });
    expect(await res.json()).toEqual({ ok: true, hiddenPosts: 2 });
  });

  it("非管理者は 404", async () => {
    state.isAdmin = false;
    expect((await post({ note: "x" })).status).toBe(404);
  });
});
