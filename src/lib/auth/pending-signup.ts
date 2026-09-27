/**
 * signup-login Task11（2026-09-22）: 「認証済みだが未登録」（登録待ち）の利用者が開ける場所
 * 出典: docs/tasks/account/signup-login/11-google-once-signup.md
 *       要件定義書 v3.2 3.2.1「未登録ユーザーのログイン」
 *
 * 【初心者向け】Google の認証は通ったが、まだ同意していないのでアプリのアカウント（users 行）が無い人。
 * この人が他の画面を開くと、投稿などが users 行を前提にしていて壊れるので、関所（proxy.ts）で
 * 同意画面と認証まわりの API 以外は通さない。判断だけを純粋関数にして単体テストの対象にする。
 */

/** 登録待ちの利用者を送る先（同意画面） */
export const PENDING_SIGNUP_PATH = "/signup";

/** 登録待ちでも開ける path。画面は同意画面とログイン画面、API は認証まわりだけ */
export function isAllowedWhilePendingSignup(pathname: string): boolean {
  if (pathname === "/signup" || pathname === "/login") return true;
  // legal-documents Task 1: 同意する前に規約を読めるように
  if (pathname === "/terms" || pathname === "/privacy" || pathname.startsWith("/api/legal/")) return true;
  return pathname.startsWith("/api/auth/");
}

/**
 * 登録待ちのリクエストをどう扱うか。null なら通す。
 * API は 401（画面ではないのでリダイレクトしない）、画面は同意画面へリダイレクト。
 */
export function pendingSignupAction(pathname: string): { kind: "pass" } | { kind: "api_denied" } | { kind: "redirect"; to: string } {
  if (isAllowedWhilePendingSignup(pathname)) return { kind: "pass" };
  if (pathname.startsWith("/api/")) return { kind: "api_denied" };
  return { kind: "redirect", to: PENDING_SIGNUP_PATH };
}
