/**
 * signup-login Task10（2026-09-22）: アカウント作成に必要な同意がそろっているか
 * 出典: docs/tasks/account/signup-login/07-consent-flow.md
 *       要件定義書 v3.2 3.2.1「同意取得」（利用規約と個人情報保護方針を別々に、両方必須）
 *
 * 【初心者向け】URL のクエリは利用者が書き換えられるので、画面でボタンを押せなくするだけでは足りない。
 * コールバック（サーバー側）でも必ずこの関数で確かめてからアカウントを作る。純粋関数なので単体テストしやすい。
 */
export function hasFullConsent(searchParams: URLSearchParams): boolean {
  return searchParams.get("terms") === "1" && searchParams.get("privacy") === "1";
}
