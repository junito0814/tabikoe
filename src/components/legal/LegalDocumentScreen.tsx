import Link from "next/link";
import { LEGAL_KIND_LABELS, LEGAL_KIND_PATHS, type LegalDocument, type LegalKind } from "@/lib/legal/legal-documents";
import { parseMarkdownBlocks } from "@/lib/legal/markdown";

/**
 * legal-documents Task 1: 規約の公開ページ（/terms・/privacy）
 * 出典: docs/tasks/admin/legal-documents/01-legal-data-and-pages.md
 *
 * 【初心者向け】表示だけ。Markdown は parseMarkdownBlocks でブロックにし、React の文字として描く（HTML は解釈しない）。
 * 版と公開日、過去の版へのリンクを上に出す。未ログインでも見られる。
 */
export function LegalDocumentScreen({
  document,
  versions,
}: {
  document: LegalDocument;
  versions: { version: string; status: string; publishedAt: string | null }[];
}) {
  const blocks = parseMarkdownBlocks(document.body);
  const path = LEGAL_KIND_PATHS[document.kind as LegalKind];
  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
      <article className="flex w-full max-w-[640px] flex-col gap-3 text-[14px] leading-[1.8] text-ink">
        <p className="flex flex-wrap items-center gap-x-3 text-[12px] text-muted">
          <span>
            {LEGAL_KIND_LABELS[document.kind as LegalKind]} 版 {document.version}
            {document.status === "archived" && "（過去の版）"}
          </span>
          {document.publishedAt && <span>公開日 {formatDate(document.publishedAt)}</span>}
          {document.status === "archived" && (
            <Link href={path} className="underline underline-offset-2">
              公開中の版を読む
            </Link>
          )}
        </p>
        {blocks.map((block, i) => {
          if (block.type === "heading") {
            const Tag = block.level === 1 ? "h1" : block.level === 2 ? "h2" : "h3";
            const cls = block.level === 1 ? "mt-2 text-[20px] font-bold" : block.level === 2 ? "mt-4 text-[15px] font-bold" : "mt-2 text-[14px] font-bold";
            return (
              <Tag key={i} id={block.id} className={cls}>
                {block.text}
              </Tag>
            );
          }
          if (block.type === "list") {
            const ListTag = block.ordered ? "ol" : "ul";
            return (
              <ListTag key={i} className={`pl-5 ${block.ordered ? "list-decimal" : "list-disc"}`}>
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ListTag>
            );
          }
          return (
            <p key={i} className="whitespace-pre-line">
              {block.text}
            </p>
          );
        })}
        {versions.length > 1 && (
          <section className="mt-6 border-t border-line pt-3 text-[12px] text-muted">
            <p className="font-medium">版の一覧</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {versions.map((v) => (
                <li key={v.version}>
                  <Link href={`${path}?version=${encodeURIComponent(v.version)}`} className="underline underline-offset-2">
                    版 {v.version}
                  </Link>
                  {v.publishedAt && ` （${formatDate(v.publishedAt)}）`}
                  {v.status === "published" && " 公開中"}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
