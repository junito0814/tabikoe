/**
 * #940（2026-10-17）: 上端の細いバーの幅を決める（純粋関数）
 * 出典: Issue #940「投稿ボタンを「投稿中」だけにし、進み具合は上端の細いバーで見せる」
 *
 * 【初心者向け】判断だけをここに切り出してあります（約束 13）。画面の作りが変わっても、
 * **壊れやすいのは計算のほう**なので、ここだけテストすれば済むようにしておきます。
 *
 * 気をつけるのは 3 つ。
 *   - **まだ総数が分からない**（`null` や 0）… `null` を返す。呼ぶ側は「流れる」表示にする
 *   - **数え過ぎ**（`done > total`）… 100% で止める（バーが枠からはみ出さない）
 *   - **0 件目**… 0% ではなく**少しだけ出す**。幅 0 だと「出ていない」と同じに見えるため
 */

/** 0 件目でも「始まっている」ことが見える最小の幅（%） */
export const MIN_VISIBLE_PERCENT = 6;

/**
 * 進み具合（%）。総数が分からないときは `null`（＝不定。流れる表示にする）。
 */
export function progressPercent(progress: { done: number; total: number } | null): number | null {
  if (progress === null) return null;
  const { done, total } = progress;
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return null;
  const ratio = Math.max(0, Math.min(1, done / total));
  return Math.max(MIN_VISIBLE_PERCENT, Math.round(ratio * 100));
}
