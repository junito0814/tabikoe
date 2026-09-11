import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isWithinRateLimit } from "./check-rate-limit";
import {
  REPORT_RATE_LIMIT_MAX_ATTEMPTS,
  REPORT_RATE_LIMIT_WINDOW_SECONDS,
} from "@/lib/reports/constants";

/**
 * 出典: docs/tasks/safety/reporting/04-report-rate-limiting.md 単体テスト
 *
 * 件数の境界値（20件目: 許可、21件目: 拒否）とウィンドウのリセットは
 * PL/pgSQL 関数 check_rate_limit の責務で、結合テスト（ローカルSupabase）で検証する。
 * ここでは Route Handler が渡すパラメータ（1日=86400秒・20件）と、
 * 関数の戻り値を許可／拒否／例外に正しく写すことを検証する。
 */
function fakeAdmin(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn(async () => result);
  return { admin: { rpc } as unknown as SupabaseClient, rpc };
}

describe("isWithinRateLimit（通報のレート制限）", () => {
  it("1日20件の設定で check_rate_limit を呼ぶ", async () => {
    const { admin, rpc } = fakeAdmin({ data: true, error: null });

    await isWithinRateLimit(
      admin,
      "user-1",
      "report_create",
      REPORT_RATE_LIMIT_WINDOW_SECONDS,
      REPORT_RATE_LIMIT_MAX_ATTEMPTS
    );

    expect(REPORT_RATE_LIMIT_WINDOW_SECONDS).toBe(86400);
    expect(REPORT_RATE_LIMIT_MAX_ATTEMPTS).toBe(20);
    expect(rpc).toHaveBeenCalledWith("check_rate_limit", {
      p_subject: "user-1",
      p_action_type: "report_create",
      p_window_seconds: 86400,
      p_limit: 20,
    });
  });

  it("上限内なら true、超過なら false を返す", async () => {
    expect(
      await isWithinRateLimit(fakeAdmin({ data: true, error: null }).admin, "u", "report_create", 86400, 20)
    ).toBe(true);
    expect(
      await isWithinRateLimit(fakeAdmin({ data: false, error: null }).admin, "u", "report_create", 86400, 20)
    ).toBe(false);
  });

  it("DBエラー時は例外を投げる（Route Handler が503に変換する）", async () => {
    const { admin } = fakeAdmin({ data: null, error: { message: "down" } });
    await expect(isWithinRateLimit(admin, "u", "report_create", 86400, 20)).rejects.toBeDefined();
  });
});
