/**
 * admin-shell-dashboard Task 3: 最終利用日を 1 日 1 回だけ記録するための判断（純粋関数）
 * 出典: docs/tasks/admin/admin-shell-dashboard/03-last-active.md
 *       要件定義書 3.10.3
 *
 * 【初心者向け】毎リクエストで DB に UPDATE すると、performance Task1・2 で減らした往復がまた増える。
 * そこで「今日はもう書いた」という印を Cookie（tabikoe-last-active-day = YYYY-MM-DD、日本時間）に持ち、
 * Cookie が今日なら DB に触らない。判断だけをここに置き、Cookie の読み書きと DB 呼び出しは proxy.ts が行う。
 * 30 日失効用の tabikoe-last-active（session-activity.ts）とは別物：あれは「時刻」を持ち 1 時間ごと、
 * こちらは「日付」を持ち 1 日ごと。
 */
export const LAST_ACTIVE_DAY_COOKIE = "tabikoe-last-active-day";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 日本時間の日付（YYYY-MM-DD） */
export function jstDayOf(now: number | Date): string {
  const ms = typeof now === "number" ? now : now.getTime();
  return new Date(ms + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Cookie が無い、または今日（JST）と違えば DB に書く */
export function shouldTouchLastActiveDay(cookieValue: string | undefined | null, now: number | Date): boolean {
  return cookieValue !== jstDayOf(now);
}

/** Cookie の属性。httpOnly・lax。日付をまたいだら値が変わるので、期限は 2 日あれば足りる */
export function lastActiveDayCookieOptions(secure: boolean) {
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 2 * 24 * 60 * 60 };
}
