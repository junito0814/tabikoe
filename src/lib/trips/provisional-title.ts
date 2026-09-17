/**
 * trip-title-v3 Task2: 仮タイトル「今日の投稿（M/D）」
 * 出典: docs/tasks/posts/trip-title-v3/02-provisional-title.md
 *       要件定義書 v3.0 3.3.4「仮タイトル」
 *
 * 【初心者向け】旅行タイトルを空のまま投稿・下書き保存したときは、この関数が作る「今日の投稿（9/16）」という
 * 旅行に入れる（同日の 2 件目以降は同じ旅行）。マイページではこの形式の旅行に「タイトルを付ける」を促す。
 * 日付は JST で決める（サーバーのタイムゾーンに依存させない）。
 */
const PROVISIONAL_PATTERN = /^今日の投稿（(\d{1,2})\/(\d{1,2})）$/;

export function provisionalTripTitle(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).formatToParts(now);
  const month = parts.find((p) => p.type === "month")?.value ?? "1";
  const day = parts.find((p) => p.type === "day")?.value ?? "1";
  return `今日の投稿（${month}/${day}）`;
}

/** マイページで「付け直し」を促す判定に使う */
export function isProvisionalTripTitle(title: string): boolean {
  return PROVISIONAL_PATTERN.test(title.trim());
}
