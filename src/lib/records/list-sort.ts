/**
 * #797（2026-10-06）: 記録の一覧（アルバム・行きたい）の並び順
 * 出典: Issue #797「行きたい・アルバム・投稿履歴の見出しを揃え、行きたいに並び順を付ける」
 *
 * 【初心者向け】アルバム一覧（#715）には「新着順／古い順」があり、行きたいには**ありません**でした。
 * 同じ「自分が貯めたもの」の一覧なのに、片方でしか並べ替えられないのは不便です。
 *
 * 読み取りの判断をここ 1 つに置くので、画面が増えても同じ約束（既定は新着順・知らない値は新着順）で
 * 動きます（約束 13・14）。アルバム一覧も**この関数に寄せました**。
 */
export const LIST_SORTS = ["newest", "oldest"] as const;
export type ListSort = (typeof LIST_SORTS)[number];

/**
 * #863（2026-10-07）: 「何の」新しい順かを言葉に入れる。
 *
 * 【初心者向け】以前は「新着順／古い順」とだけ出していて、**何の日付で並ぶのか分かりません**でした
 * （保存した日なのか、投稿された日なのか、スポットができた日なのか）。
 * 画面ごとに基準が違うので、基準の言葉（「保存」「作成」）を受け取って作ります。
 * アルバム一覧がラベルを自前で書いていたのも、ここに寄せました（約束 14）。
 */
export type ListSortBasis = "保存" | "作成";

export function listSortLabel(sort: ListSort, basis: ListSortBasis): string {
  return sort === "newest" ? `${basis}が新しい順` : `${basis}が古い順`;
}

/** `?sort=` の読み取り。既定は新着順（知らない値も新着順に倒す） */
export function parseListSort(value: string | null | undefined): ListSort {
  return value === "oldest" ? "oldest" : "newest";
}

/** DB の `order()` に渡す向き。新着順は新しいものが先なので降順 */
export function isAscending(sort: ListSort): boolean {
  return sort === "oldest";
}
