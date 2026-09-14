import { describe, expect, it } from "vitest";
import { escapeHtml, unescapeHtml, validateCommentBody } from "./validate-comment";

/**
 * 出典: docs/tasks/browsing/comments/01-comment-create-handler.md 単体テスト
 * - 4,000文字ちょうどのコメントが保存できることを検証する
 * - 4,001文字（絵文字含む書記素クラスタ単位）のコメントが拒否されることを検証する
 * - `<script>`タグ等を含む入力が、保存後にスクリプトとして解釈されない形にエスケープされていることを検証する
 */
describe("validateCommentBody", () => {
  it("4,000文字ちょうどは保存できる", () => {
    const result = validateCommentBody("あ".repeat(4000));
    expect(result.ok).toBe(true);
  });

  it("4,001文字は拒否される", () => {
    expect(validateCommentBody("あ".repeat(4001))).toEqual({ ok: false, error: "body_too_long" });
  });

  it("絵文字（結合文字を含む）は書記素クラスタ単位で1文字として数える", () => {
    const family = "👨‍👩‍👧‍👦"; // ZWJ 結合の1グラフェム
    expect(validateCommentBody(family.repeat(4000)).ok).toBe(true);
    expect(validateCommentBody(family.repeat(4001))).toEqual({ ok: false, error: "body_too_long" });
  });

  it("空・空白のみは拒否される", () => {
    expect(validateCommentBody("")).toEqual({ ok: false, error: "body_required" });
    expect(validateCommentBody("   ")).toEqual({ ok: false, error: "body_required" });
    expect(validateCommentBody(123)).toEqual({ ok: false, error: "body_required" });
  });

  it("<script> タグ等はスクリプトとして解釈されない形にエスケープされる", () => {
    const result = validateCommentBody(`<script>alert("x")</script><img src=x onerror='y'>`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).not.toContain("<");
    expect(result.body).not.toContain(">");
    expect(result.body).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&lt;img src=x onerror=&#39;y&#39;&gt;"
    );
  });
});

describe("escapeHtml / unescapeHtml", () => {
  it("往復で元の文字列に戻る", () => {
    const original = `A & B < C > "D" 'E'`;
    expect(unescapeHtml(escapeHtml(original))).toBe(original);
  });
});
