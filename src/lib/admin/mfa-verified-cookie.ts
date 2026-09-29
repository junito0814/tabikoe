/**
 * admin-login Task 5: 「最後に 6 桁を通した時刻」を持つ Cookie
 * 出典: docs/tasks/admin/admin-login/05-mfa-screen.md
 *       要件定義書 3.10.1（管理セッションの寿命 60 分・重い操作の前の再確認 10 分）
 *
 * 【初心者向け】60 分と 10 分の 2 つの期限は、この 1 つの時刻から数える。
 * httpOnly にするのでブラウザの JS からは読めず、書けるのはサーバーだけ。
 * しかもサーバーは「その場で 6 桁を検証できたとき」しか書かない（api/admin/mfa/verify）。
 * ここを JS から書ける値にすると、Cookie を 1 行いじるだけで期限を伸ばされてしまう。
 *
 * DB にテーブルは増やさない。二段階確認の登録そのものは Supabase Auth（auth.mfa_factors）が持つ。
 */
import { ADMIN_SESSION_MAX_AGE_SECONDS } from "./mfa-gate";

/** 値は epoch ミリ秒の文字列 */
export const ADMIN_MFA_VERIFIED_COOKIE = "tabikoe-admin-mfa";

/** Cookie の値を読む。無い・壊れている・0 以下なら null（＝未確認として扱う） */
export function parseMfaVerifiedAt(value: string | undefined | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Cookie の属性。
 * 有効期間は 60 分に合わせる（期限が来たら Cookie ごと消え、読めない＝未確認になる）。
 * path を "/" にするのは、`/api/admin/...` からも読めるようにするため。
 */
export function mfaVerifiedCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  };
}
