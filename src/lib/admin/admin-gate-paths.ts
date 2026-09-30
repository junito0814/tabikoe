/**
 * admin-login Task 6: 関所が「そのアドレスをどう扱うか」を決める（純粋関数）
 * 出典: docs/tasks/admin/admin-login/06-proxy-aal2-gate.md
 *       要件定義書 3.10.1
 *
 * 【初心者向け】管理画面まわりのアドレスは 3 種類ある。
 *   - mfa_entry … 二段階確認そのものの入口。ここを通ることで aal2 になるので、6 桁を求めてはいけない
 *                 （求めると登録も確認もできず、堂々巡りになる）
 *   - api       … 画面ではなく API。足りないときは転送ではなく 401 を返す（fetch は転送を追ってしまうため）
 *   - page      … ふつうの管理画面。足りないときは SC-32 へ送る
 */
import { ADMIN_MFA_PATH } from "./mfa-redirect";

/** 二段階確認の API（登録と確認）。どちらも aal2 でない人が通る必要がある */
export const ADMIN_MFA_API_PREFIX = "/api/admin/mfa";

/** 管理者だけが呼ぶ API */
export const ADMIN_API_PREFIX = "/api/admin";

export type AdminGatePathKind = "mfa_entry" | "api" | "page" | null;

/** 判定の順番が大事。二段階確認の入口を最初に見ないと、そこにも 6 桁を求めてしまう */
export function adminGatePath(pathname: string): AdminGatePathKind {
  if (pathname === ADMIN_MFA_PATH || pathname.startsWith(`${ADMIN_MFA_PATH}/`)) return "mfa_entry";
  if (pathname === ADMIN_MFA_API_PREFIX || pathname.startsWith(`${ADMIN_MFA_API_PREFIX}/`)) return "mfa_entry";
  if (pathname === ADMIN_API_PREFIX || pathname.startsWith(`${ADMIN_API_PREFIX}/`)) return "api";
  // `/admin` で始まるものはすべて管理画面として扱う（Task 1 からの挙動を変えない）
  if (pathname.startsWith("/admin")) return "page";
  return null;
}
