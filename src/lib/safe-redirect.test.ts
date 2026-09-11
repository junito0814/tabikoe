import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

/**
 * 出典: docs/tasks/account/signup-login/03-login-screen-ui.md（redirect_toの引き継ぎ）
 *       docs/tasks/account/session-management/03-refresh-token-expiry-rule.md（元の遷移先の保持）
 *
 * ログイン後の遷移先として外部ドメインを渡されても、オープンリダイレクトにならないこと。
 */
describe("safeRedirectPath", () => {
  it("アプリ内のパスはそのまま返す", () => {
    expect(safeRedirectPath("/account")).toBe("/account");
    expect(safeRedirectPath("/posts/abc/edit")).toBe("/posts/abc/edit");
  });

  it("クエリ付きのパスもそのまま返す", () => {
    expect(safeRedirectPath("/posts/new?tab=1")).toBe("/posts/new?tab=1");
  });

  it("未指定・空文字はトップページへ", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath("")).toBe("/");
  });

  it("絶対URL（外部ドメイン）は拒否してトップページへ", () => {
    expect(safeRedirectPath("https://evil.example.com/")).toBe("/");
    expect(safeRedirectPath("http://evil.example.com")).toBe("/");
  });

  it("スキーム相対URL（//で始まる）は拒否してトップページへ", () => {
    // "//evil.example.com" はブラウザで https://evil.example.com と解釈される
    expect(safeRedirectPath("//evil.example.com")).toBe("/");
  });

  it("スラッシュで始まらない文字列は拒否してトップページへ", () => {
    expect(safeRedirectPath("account")).toBe("/");
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/");
  });
});
