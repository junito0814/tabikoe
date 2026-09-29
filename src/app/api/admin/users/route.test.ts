import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimsResultOf } from "@/lib/auth/claims-result";

/** 出典: docs/tasks/admin/user-management/01-user-list.md 単体テスト（検索・絞り込みが問い合わせに乗ること、一般利用者は 404） */
const state = { user: { id: "admin-1" } as { id: string } | null, isAdmin: true };
const applied: string[] = [];

function chain(result: unknown) {
  const c: Record<string, unknown> = {};
  for (const op of ["eq", "neq", "or", "is", "not", "gt", "in", "order", "range"]) {
    c[op] = (...args: unknown[]) => {
      applied.push(`${op}:${args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(",")}`);
      return c;
    };
  }
  c.then = (resolve: (v: unknown) => void) => resolve(result);
  return c;
}

const userRows = [
  { id: "u1", display_name: "はなこ", email: "h@example.com", created_at: "2026-09-01T00:00:00Z", last_active_at: "2026-09-27T00:00:00Z", suspended_at: null, suspension_kind: null, posting_restricted_until: null },
];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: async () => claimsResultOf(state.user) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: (columns: string) => {
        if (table === "users" && columns === "is_admin") return { eq: () => ({ maybeSingle: async () => ({ data: { is_admin: state.isAdmin } }) }) };
        if (table === "users") return chain({ data: userRows, error: null, count: 1 });
        if (table === "posts") return chain({ data: [{ id: "p1", user_id: "u1", status: "published" }, { id: "p2", user_id: "u1", status: "draft" }], error: null });
        if (table === "comments") return chain({ data: [{ id: "c1", user_id: "u1" }], error: null });
        if (table === "strikes") return chain({ data: [{ user_id: "u1", created_at: "2026-09-20T00:00:00Z", expires_at: "2026-12-19T00:00:00Z", revoked_at: null }], error: null });
        if (table === "reports") return chain({ data: [{ target_type: "post", target_id: "p1" }, { target_type: "comment", target_id: "c1" }, { target_type: "user", target_id: "u1" }, { target_type: "post", target_id: "other" }], error: null });
        return chain({ data: [], error: null });
      },
    }),
  }),
}));

import { GET } from "./route";

beforeEach(() => {
  state.user = { id: "admin-1" };
  state.isAdmin = true;
  applied.length = 0;
});

describe("GET /api/admin/users", () => {
  it("一般利用者では 404", async () => {
    state.isAdmin = false;
    expect((await GET(new Request("http://localhost/api/admin/users"))).status).toBe(404);
  });

  it("検索と状態の絞り込みが問い合わせに乗り、投稿数・通報された回数・有効なストライクを付けて返す", async () => {
    const res = await GET(new Request("http://localhost/api/admin/users?q=はな&status=provisional"));
    expect(res.status).toBe(200);
    expect(applied.some((a) => a.startsWith("or:display_name.ilike.%はな%,email.ilike.%はな%"))).toBe(true);
    expect(applied).toContain("eq:suspension_kind,provisional");
    const body = await res.json();
    expect(body.users[0]).toMatchObject({ id: "u1", displayName: "はなこ", postCount: 1, reportedCount: 3, activeStrikes: 1, status: "normal" });
    expect(body.nextOffset).toBeNull();
  });
});
