/**
 * legal-documents Task 1: 規約の本文（Markdown）を画面のブロックに分ける（純粋関数）
 * 出典: docs/tasks/admin/legal-documents/01-legal-data-and-pages.md
 *
 * 【初心者向け】外部の Markdown ライブラリは入れず、規約に要る分だけ（見出し・段落・箇条書き・番号つき）を自前で読む。
 * HTML は解釈しない（本文はそのまま文字として出す）ので、管理者がタグを書いても実行されない。
 */
export type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string; id: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] };

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let headingCount = 0;

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      headingCount += 1;
      blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2].trim(), id: headingId(heading[2], headingCount) });
    } else if (bullet || numbered) {
      flushParagraph();
      const ordered = !!numbered;
      const text = (bullet ?? numbered)![1].trim();
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(text);
    } else if (line.trim() === "") {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** 見出しのアンカー。「第4条（禁止事項）」→ prohibited のような別名は付けず、「h-4」の形で連番 */
function headingId(text: string, index: number): string {
  const article = /第(\d+)条/.exec(text);
  return article ? `article-${article[1]}` : `h-${index}`;
}
