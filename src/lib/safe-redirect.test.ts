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

/**
 * #997（2026-10-18）: 判定を「ブラウザが読む形にそろえてから見る」形に直した。
 *
 * 【初心者向け】ここでは**書き方を 1 つずつ数え上げる**のではなく、
 * 「**返ってきた値をブラウザと同じやり方で読んだとき、行き先が自分のサイトであること**」を見ます。
 * 数え上げだと、知らない書き方が出てきたときに見落とします。
 * `new URL(行き先, 自分のサイト)` は、ブラウザが使うのと同じ規則で URL を読む仕組みです。
 */
describe("safeRedirectPath: 読んだあとの行き先（#997）", () => {
  const SITE = "https://tabikoe.example";

  /** ブラウザと同じ規則で読んだときの行き先（オリジン）を返す */
  function destinationOrigin(value: string): string {
    return new URL(value, `${SITE}/consent/renew`).origin;
  }

  const OUTSIDE_ATTEMPTS = [
    "//evil.example.com",
    "https://evil.example.com/",
    "http://evil.example.com",
    "/\\evil.example.com",
    "/\\/evil.example.com",
    "/\\\\evil.example.com",
    "/\t/evil.example.com",
    "/\n/evil.example.com",
    "/\r/evil.example.com",
    "\\/evil.example.com",
    "/\t\\evil.example.com",
    "java\nscript:alert(1)",
  ];

  it("外に出ようとする書き方は、どれも自分のサイトに留まる", () => {
    for (const attempt of OUTSIDE_ATTEMPTS) {
      const result = safeRedirectPath(attempt);
      expect(destinationOrigin(result), `${JSON.stringify(attempt)} の行き先`).toBe(SITE);
    }
  });

  it("外に出ようとする書き方は、トップページに落とす", () => {
    for (const attempt of OUTSIDE_ATTEMPTS) {
      expect(safeRedirectPath(attempt), JSON.stringify(attempt)).toBe("/");
    }
  });

  it("アプリ内のパスは、いままでどおりそのまま通る", () => {
    for (const path of [
      "/",
      "/account",
      "/posts/abc/edit",
      "/posts/new?tab=1",
      "/search?q=%E6%9C%AD%E5%B9%8C",
      "/mypage#tab",
      "/post-history?back=/mypage",
      "/..//evil.example.com",
      "/@evil.example.com",
    ]) {
      expect(safeRedirectPath(path), path).toBe(path);
      expect(destinationOrigin(safeRedirectPath(path)), path).toBe(SITE);
    }
  });

  it("目に見えない文字は取り除いてから返す（ブラウザが捨てるのと同じ）", () => {
    expect(safeRedirectPath("/acc\tount")).toBe("/account");
    expect(safeRedirectPath("/acc\nount")).toBe("/account");
  });
});
