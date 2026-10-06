import type { PostCategory } from "./constants";
import type { ComposeSource } from "./compose-initial-state";

/**
 * #794（2026-10-06）: 「おすすめ」のカテゴリを出すかどうかの判断
 * 出典: Issue #794「投稿作成のカテゴリに「おすすめ」を 1 つ出す（既存スポットの代表カテゴリ）」
 *
 * 【初心者向け】カテゴリには初期値がありません。毎回「開く・選ぶ」の 2 タップが要ります。
 * いっぽう、そのスポットの**代表カテゴリ**を投稿から決める関数（`resolveSpotCategory`。
 * 地図のピンの色に使っているもの）が既にあります。浅草寺の投稿が全部「観光スポット」なら、
 * それを「おすすめ」として出せます。
 *
 * **勝手には入れません。** 外れたまま投稿されるのを防ぐため、入れるのは利用者です。
 *
 * 出さない場面:
 *
 *   - **すでに値が入っている**（下書きの続き・編集・一度選んだあと）── 邪魔になる
 *   - **投稿の無いスポット・新しい場所**（代表カテゴリが決まらない）
 *   - 下書きの続き・編集（`source` が `draft`／`edit`）── 書き直しの最中に横から勧めない
 *
 * 判断をこの関数だけに閉じ込めておくと、画面の作りが変わってもここだけテストすれば済みます（約束 13）。
 */
export function suggestedCategory({
  spotCategory,
  current,
  source,
}: {
  /** そのスポットの代表カテゴリ（`resolveSpotCategory` の結果）。投稿が無ければ null */
  spotCategory: PostCategory | null;
  /** 今カテゴリの欄に入っている値（空文字なら未選択） */
  current: string;
  source: ComposeSource;
}): PostCategory | null {
  if (source === "draft" || source === "edit") return null;
  if (current !== "") return null;
  return spotCategory;
}
