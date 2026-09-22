import { describe, expect, it } from "vitest";
import { authUserFromClaims, getAuthUserFromClaims } from "./auth-user";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 出典: docs/tasks/shared-ui/performance/01-fewer-round-trips.md 単体テスト
 * - claims → AuthUser の変換（sub が無ければ null、email の有無）
 * - getClaims がエラー／空なら null
 */
const client = (result: { data: { claims: Record<string, unknown> } | null; error: Error | null }) =>
  ({ auth: { getClaims: async () => result } }) as unknown as SupabaseClient;

describe("auth-user（getClaims による認証確認）", () => {
  it("sub と email から AuthUser を作る。email が無ければ null", () => {
    expect(authUserFromClaims({ sub: "u1", email: "a@b" })).toEqual({ id: "u1", email: "a@b" });
    expect(authUserFromClaims({ sub: "u1" })).toEqual({ id: "u1", email: null });
  });

  it("sub が無い・空・claims 自体が無いなら null", () => {
    expect(authUserFromClaims({ email: "a@b" })).toBeNull();
    expect(authUserFromClaims({ sub: "" })).toBeNull();
    expect(authUserFromClaims(null)).toBeNull();
  });

  it("getClaims がエラーや空を返したら null、正常なら AuthUser", async () => {
    expect(await getAuthUserFromClaims(client({ data: null, error: new Error("invalid") }))).toBeNull();
    expect(await getAuthUserFromClaims(client({ data: null, error: null }))).toBeNull();
    expect(await getAuthUserFromClaims(client({ data: { claims: { sub: "u1", email: "a@b" } }, error: null }))).toEqual({ id: "u1", email: "a@b" });
  });
});
