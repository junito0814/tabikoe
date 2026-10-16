/**
 * #929: 「いつの報告か」を相対で出す
 * 出典: Issue #929、要件定義書 4.5.19
 *
 * 【初心者向け】Google マップもほかの SNS も、クチコミの日付は **常に相対**で出します
 * （「1 か月前」「1 年前」）。日付そのものより「**古いかどうか**」が知りたいからです。
 * ~~1 年以上前のものだけ年を出す~~ → 境目を決める話が要るうえ、どこもやっていないので採りませんでした。
 *
 * ここは**純粋関数だけ**です（約束 13）。今の時刻は引数で受け取ります。
 */
export function visitFindingAge(reportedAt: string, now: Date = new Date()): string {
  const then = new Date(reportedAt);
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (days < 0) return "今月";
  if (days < 31) return "今月";
  const months = Math.floor(days / 30.4);
  if (months < 2) return "先月";
  if (months < 12) return `${months} か月前`;
  return "1 年以上前";
}
