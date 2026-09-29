/**
 * admin-login Task 5: 二段階確認のあとに戻る先を決める（純粋関数）
 * 出典: docs/tasks/admin/admin-login/05-mfa-screen.md
 *       要件定義書 3.10.1「通ったら元の行き先へ進める」
 *
 * 【初心者向け】`?redirect_to=…` はブラウザから来る値なので、そのまま信じて転送すると
 * 外部サイトへ飛ばす踏み台（オープンリダイレクト）にされる。ここで「/admin 配下だけ」に絞る。
 */

/** 二段階確認の画面（SC-32） */
export const ADMIN_MFA_PATH = "/admin/mfa";

/** 行き先が分からないときの既定（管理者ダッシュボード SC-16） */
export const ADMIN_HOME_PATH = "/admin";

/**
 * 二段階確認を通したあとに戻る先。`/admin` 配下でなければ既定に落とす。
 *
 * 弾くもの:
 * - 文字列でない値
 * - `//example.com`（プロトコル相対。ブラウザは外部サイトとして解釈する）
 * - `\` を含む値（ブラウザが `/` に直すため `/\/example.com` のような抜け道になる）
 * - `/admin-secret` のように「/admin で始まるだけ」の別のパス
 * - `/admin/mfa` 自身（ここへ戻すと確認のあともう一度確認になり、堂々巡りになる）
 */
export function safeAdminRedirect(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return ADMIN_HOME_PATH;
  if (!value.startsWith("/") || value.startsWith("//")) return ADMIN_HOME_PATH;
  if (value.includes("\\")) return ADMIN_HOME_PATH;

  // クエリ・ハッシュを外した「パスだけ」で判定する（?next=… に紛れ込ませられないように）
  const path = value.split(/[?#]/)[0];
  if (path !== ADMIN_HOME_PATH && !path.startsWith(`${ADMIN_HOME_PATH}/`)) return ADMIN_HOME_PATH;
  if (path === ADMIN_MFA_PATH || path.startsWith(`${ADMIN_MFA_PATH}/`)) return ADMIN_HOME_PATH;
  return value;
}

/** SC-32 への行き先を組み立てる（元の場所を redirect_to に残す） */
export function buildAdminMfaPath(currentPath: string): string {
  const safe = safeAdminRedirect(currentPath);
  if (safe === ADMIN_HOME_PATH) return ADMIN_MFA_PATH;
  return `${ADMIN_MFA_PATH}?redirect_to=${encodeURIComponent(safe)}`;
}
