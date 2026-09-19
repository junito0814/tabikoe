import { safeRedirectPath } from "@/lib/safe-redirect";

/**
 * F-AC-02 Task3: リフレッシュトークンの 30 日失効ルール（最終利用から 30 日で再ログイン）
 * 出典: docs/tasks/account/session-management/03-refresh-token-expiry-rule.md
 *       要件定義書 3.2「リフレッシュトークン: 有効期限30日。最終利用から30日経過した場合は再ログインを求める」
 *
 * 【初心者向け】Supabase のリフレッシュトークンは（無料プランでは）勝手に期限切れにならない。
 * そこでアプリ側で「最後に使った日時」を httpOnly の Cookie（tabikoe-last-active）に持ち、
 * 関所（src/proxy.ts）で毎回見て、30 日を超えていたらセッションを破棄してログイン画面へ送る。
 * ここには判断だけ（純粋関数）を置き、Cookie の読み書きは proxy に任せる。単体テストの対象。
 */

/** 最終利用日時を入れる Cookie 名（値は epoch ミリ秒の文字列） */
export const LAST_ACTIVE_COOKIE = "tabikoe-last-active";

/** 最終利用からこれを超えたら再ログイン（30 日） */
export const SESSION_INACTIVITY_LIMIT_MS = 30 * 24 * 60 * 60 * 1000;

/** Cookie の書き換えは毎リクエストではなく、前回から 1 時間空いたときだけ（レスポンスに毎回 Set-Cookie を載せない） */
export const LAST_ACTIVE_TOUCH_INTERVAL_MS = 60 * 60 * 1000;

/** Cookie の値（epoch ミリ秒）を読む。壊れていれば null */
export function parseLastActive(value: string | undefined | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * 最終利用から 30 日を超えているか。記録が無ければ（初回・Cookie が消えた）失効とはみなさない。
 * 【初心者向け】「記録が無い＝失効」にすると、Cookie を消しただけで全員締め出されるので、無いときは今から数え始める。
 */
export function isSessionExpiredByInactivity(lastActive: number | null, now: number): boolean {
  if (lastActive === null) return false;
  return now - lastActive > SESSION_INACTIVITY_LIMIT_MS;
}

/** 最終利用日時を書き直すべきか（記録が無い、または前回から 1 時間以上） */
export function shouldTouchLastActive(lastActive: number | null, now: number): boolean {
  if (lastActive === null) return true;
  return now - lastActive >= LAST_ACTIVE_TOUCH_INTERVAL_MS;
}

/** Cookie の属性。セッション Cookie と同じく httpOnly・lax。有効期間は 30 日＋余裕（超過の判定はサーバーで行う） */
export function lastActiveCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(SESSION_INACTIVITY_LIMIT_MS / 1000) + 24 * 60 * 60,
  };
}

/**
 * 失効時のログイン画面の URL を組み立てる。元の遷移先は redirect_to に残す（再ログイン後に復帰）。
 * ログイン・登録画面そのものが元の遷移先なら redirect_to は付けない。
 */
export function buildExpiredLoginPath(currentPath: string): string {
  const params = new URLSearchParams({ error: "expired" });
  if (!currentPath.startsWith("/login") && !currentPath.startsWith("/signup")) {
    params.set("redirect_to", safeRedirectPath(currentPath));
  }
  return `/login?${params.toString()}`;
}
