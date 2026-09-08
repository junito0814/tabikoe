/**
 * F-AC-02 Task4: Cookieセキュリティ属性の共通設定
 * 出典: docs/tasks/account/session-management/04-cookie-security-attributes.md
 *
 * @supabase/ssrのDEFAULT_COOKIE_OPTIONSは httpOnly: false のため、
 * 明示的に上書きしないとアクセストークン・リフレッシュトークンがブラウザJSから参照できてしまう。
 * サーバー側（Route Handlers・Proxy）でセッションCookieを発行する箇所は、
 * すべてこの設定を`createServerClient`の`cookieOptions`に渡すこと。
 */
export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
};
