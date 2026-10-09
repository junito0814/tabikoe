import { unescapeHtml } from "@/lib/comments/validate-comment";

/**
 * #885（2026-10-09）: カードに出す「最新のコメント 1 件」の抜き出し方。
 *
 * 【初心者向け】なぜ別のファイルに切り出したか。
 *   もとは `src/lib/posts/post-cards.ts` にありました。あちらは**サーバー専用**で、
 *   Supabase のクライアントや署名付き URL の処理を抱えています。
 *   コメントのシート（`CommentSection`。ブラウザで動く）から読むと、
 *   **サーバーの処理一式がブラウザ側の荷物に混ざります**（開発中の警告で気づきました）。
 *
 *   中身は「1 行目を取り出す」だけの純粋関数なので、どちらからも読めるところへ移しました。
 *   サーバーとブラウザで**同じ切り出し方**にしておかないと、シートを閉じたときに
 *   カードの文字が微妙に変わってしまいます（約束 14: 同じものを 2 か所に書かない）。
 */
export function commentExcerpt(body: string): string {
  return unescapeHtml(body).split(/\r?\n/)[0]?.trim() ?? "";
}
