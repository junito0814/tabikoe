/**
 * 出典: #714（操作ログの 90 日削除を入れる）
 * 要件定義書 7.5「運用・保守」、個人情報保護方針 1.1「5. 保存期間」
 *
 * 【初心者向け】要件にも方針にも「操作の記録は 90 日」と書いてあるのに、
 * **消す仕組みが無かった**（`20260911000002_create_operation_logs_table.sql` に
 * 「90日超の物理削除バッチは本タスクの対象外」と書かれたまま）。
 * つまり**やっていないことを書いている**状態だった。版 1.1 を公開する前に揃える。
 *
 * 消すのは `operation_logs` **だけ**。
 *   - `admin_actions`（運営者の対応の記録）は**消さない**。方針 5. に「消しません」と明記してある
 *   - `notifications` の 90 日は**表示で切っているだけ**で、物理削除はしていない（方針も
 *     「90 日を超えたものは表示しません」と書いてある）。今回は触らない
 */
export const OPERATION_LOG_RETENTION_DAYS = 90;

/**
 * この時刻より古い行を消す、という境目を返す（純粋関数。約束 13）。
 * 「ちょうど 90 日前」は**残す**（消すのはそれより古いもの）。
 */
export function operationLogCutoff(now: Date = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - OPERATION_LOG_RETENTION_DAYS);
  return cutoff;
}

/**
 * Vercel が送ってくる合言葉を確かめる。
 *
 * 【初心者向け】この窓口は誰でも開けると困る（消す処理のため）。Vercel は環境変数
 * `CRON_SECRET` を設定しておくと `Authorization: Bearer <その値>` を付けて呼んでくれる。
 * **合言葉が設定されていないときは誰も通さない**（うっかり公開しないため）。
 */
export function isAuthorizedCronRequest(authorizationHeader: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  return authorizationHeader === `Bearer ${secret}`;
}
