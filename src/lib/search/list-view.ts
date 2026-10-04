/**
 * photo-view Task2: 投稿一覧の表示（投稿／写真）の値と読み取り
 * 出典: docs/tasks/map-search/photo-view/02-view-toggle-ui.md
 *
 * 【初心者向け】`?view=photos` を読む純粋関数。サーバー（/search の page.tsx）とブラウザ（ViewToggle）の両方から使うので、
 * `"use client"` の付いたコンポーネントファイルではなく、この何も付かないファイルに置く。
 * Next.js では `"use client"` のファイルから export した関数はサーバーから呼べない（#419 の原因）。
 */
/**
 * #681（2026-10-05）: 検索結果に「地図」を足した（決定事項 71）。
 * スポット別の投稿一覧では使わない（そのスポットは決まっているため）。
 */
export type ListView = "posts" | "photos" | "map";

export function parseListView(value: string | null | undefined): ListView {
  if (value === "photos") return "photos";
  if (value === "map") return "map";
  return "posts";
}
