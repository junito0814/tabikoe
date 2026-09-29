import { describe, expect, it } from "vitest";
import { parseMarkdownBlocks } from "./markdown";

/** 出典: docs/tasks/admin/legal-documents/01-legal-data-and-pages.md 単体テスト */
describe("parseMarkdownBlocks", () => {
  it("見出し・段落・箇条書き・番号つきに分け、条文の見出しにはアンカーが付く", () => {
    const blocks = parseMarkdownBlocks(`# タイトル\n\n前文です。\n続きです。\n\n## 第4条（禁止事項）\n\n- ひとつ\n- ふたつ\n\n1. いち\n2. に\n<script>alert(1)</script>`);
    expect(blocks).toEqual([
      { type: "heading", level: 1, text: "タイトル", id: "h-1" },
      { type: "paragraph", text: "前文です。\n続きです。" },
      { type: "heading", level: 2, text: "第4条（禁止事項）", id: "article-4" },
      { type: "list", ordered: false, items: ["ひとつ", "ふたつ"] },
      { type: "list", ordered: true, items: ["いち", "に"] },
      { type: "paragraph", text: "<script>alert(1)</script>" },
    ]);
  });
});
