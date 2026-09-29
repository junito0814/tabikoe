import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimsResultOf } from "@/lib/auth/claims-result";

/** 出典: docs/tasks/admin/user-management/04-admin-actions-log.md 単体テスト（絞り込みが問い合わせに乗ること・非管理者は 404） */
const state = { user: { id: "admin-1" } as { id: string } | null, isAdmin: true };
const applied: string[] = [];

function queryChain() {
  const chain: Record<string, unknown> = {};
  for (const op of ["order", "range", "is", "eq", "gte", "lte"]) {
    chain[op] = (...args: unknown[]) => {
      applied.push(`${op}:${args.join(",")}`);
      return chain;
    };
  }
  chain.then = (resolve: (v: unknown) => void) =>
    resolve({ data: [{ id: "a1", actor_id: null, action: "auto_hide", target_type: "post", target_id: "p1", target_label: "x", note: null, created_at: "2026-09-26T00:00:00Z", actor: null }], error: null, count: 1 });
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: async () => claimsResultOf(state.user) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "users") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_admin: state.isAdmin } }) }) }) };
      return { select: () => queryChain() };
    },
  }),
}));

import { GET } from "./route";

beforeEach(() => {
  state.user = { id: "admin-1" };
  state.isAdmin = true;
  applied.length = 0;
});

describe("GET /api/admin/actions", () => {
  it("非管理者は 404", async () => {
    state.isAdmin = false;
    const res = await GET(new Request("http://localhost/api/admin/actions"));
    expect(res.status).toBe(404);
  });

  it("絞り込み（自動・操作・期間）が問い合わせに乗り、自動の行は「自動」として返る", async () => {
    const res = await GET(new Request("http://localhost/api/admin/actions?actor=auto&action=auto_hide&from=2026-09-01"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(applied).toContain("is:actor_id,");
    expect(applied).toContain("eq:action,auto_hide");
    expect(applied.some((a) => a.startsWith("gte:created_at,2026-09-01"))).toBe(true);
    expect(body.actions[0].actorName).toBe("自動");
    expect(body.nextOffset).toBeNull();
  });
});
