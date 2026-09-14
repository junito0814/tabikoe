import { describe, expect, it } from "vitest";
import { resolvePostLoginRedirect } from "./post-login-redirect";

/**
 * 出典: docs/tasks/admin/admin-login/02-post-login-redirect.md 単体テスト
 * - 管理者ログイン画面（SC-15）経由かつ is_admin=true のケースで、遷移先が管理者ダッシュボードのパスになることを検証する
 * - 一般ログイン画面（SC-01）経由のケースでは、is_admin の値によらず遷移先分岐が発生しないことを検証する
 */
describe("resolvePostLoginRedirect", () => {
  it("SC-15 経由かつ is_admin なら /admin", () => {
    expect(resolvePostLoginRedirect({ fromAdminLogin: true, isAdmin: true, redirectTo: "/map" })).toBe("/admin");
  });

  it("SC-15 経由でも is_admin でなければ元の遷移先", () => {
    expect(resolvePostLoginRedirect({ fromAdminLogin: true, isAdmin: false, redirectTo: "/map" })).toBe("/map");
  });

  it("SC-01 経由なら is_admin の値によらず元の遷移先", () => {
    expect(resolvePostLoginRedirect({ fromAdminLogin: false, isAdmin: true, redirectTo: "/posts/1" })).toBe("/posts/1");
    expect(resolvePostLoginRedirect({ fromAdminLogin: false, isAdmin: false, redirectTo: "/" })).toBe("/");
  });
});
