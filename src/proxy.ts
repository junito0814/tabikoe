import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { assertSupabaseEnv } from "@/lib/supabase/env";
import { sessionCookieOptions } from "@/lib/supabase/cookie-options";
import {
  buildExpiredLoginPath,
  isSessionExpiredByInactivity,
  LAST_ACTIVE_COOKIE,
  lastActiveCookieOptions,
  parseLastActive,
  shouldTouchLastActive,
} from "@/lib/auth/session-activity";

/**
 * F-AC-02 Task1〜2（セッション検証・アクセストークンの透過的リフレッシュ）
 * + F-AD-01 Task1（管理画面is_admin判定）。
 * 出典: docs/tasks/account/session-management/01-session-verification-middleware.md
 *       docs/tasks/account/session-management/02-access-token-auto-refresh.md
 *       docs/tasks/admin/admin-login/01-admin-route-middleware.md
 *
 * F-AC-02 Task3（最終利用から 30 日で再ログイン）もここ。最終利用日時を Cookie（tabikoe-last-active）に持ち、
 * 30 日を超えていればトークンを更新せずセッションを破棄し、元の遷移先を redirect_to に付けてログイン画面へ送る。
 *
 * ほぼ全ページで実行する。supabase.auth.getUser()はアクセストークン期限切れを検知すると
 * リフレッシュトークンで自動的に再発行し（Supabaseはローテーションするため）、
 * その新しいCookieをこのProxyのレスポンスに載せて透過的に更新する。
 * Server Component（src/lib/supabase/server.ts）はCookieを変更できないため、
 * この仕組みがないとリフレッシュトークンのローテーションに追従できずセッションが失われる。
 *
 * /admin配下は、存在自体を一般ユーザーに露出させないため、
 * 未ログイン・is_admin=falseのいずれも404を返す（リダイレクトしない）。
 *
 * 【初心者向け】Next.js 16 では middleware.ts が proxy.ts に改名された。役割は「すべてのリクエストが
 * ページや API に届く前に通る関所」。ここでやることは 3 つ：
 *   1. Cookie のトークンを確かめ、期限切れなら裏で更新して新しい Cookie を返す（利用者は気づかない）
 *      ただし最終利用から 30 日を超えていたら更新せずに締め出す（Task3）
 *   2. 一時停止されたアカウントを締め出す
 *   3. /admin 配下を管理者以外に見せない（404）
 * 「未ログインならログイン画面へ」の誘導はここではなく、各ページの requireUserOrRedirect が行う
 * （元の遷移先を redirect_to に持たせるため）。`config.matcher` は静的ファイルを対象外にする条件。
 */
export async function proxy(request: NextRequest) {
  assertSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: sessionCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // F-AC-02 Task3: 最終利用から 30 日を超えていたら、トークンを更新せずセッションを破棄してログイン画面へ。
  // セッション Cookie（sb-…-auth-token）が無ければ判定しない（未ログインの人に古い記録が残っていても無害）
  const now = Date.now();
  const lastActive = parseLastActive(request.cookies.get(LAST_ACTIVE_COOKIE)?.value);
  const hasSessionCookie = request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
  if (hasSessionCookie && isSessionExpiredByInactivity(lastActive, now)) {
    await supabase.auth.signOut();
    if (request.nextUrl.pathname.startsWith("/api/")) {
      const denied = NextResponse.json({ error: "session_expired" }, { status: 401 });
      response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie));
      denied.cookies.delete(LAST_ACTIVE_COOKIE);
      return denied;
    }
    const redirect = NextResponse.redirect(new URL(buildExpiredLoginPath(request.nextUrl.pathname), request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.cookies.delete(LAST_ACTIVE_COOKIE);
    return redirect;
  }

  // リフレッシュトークンが失効している場合もuser=nullとして返る
  // （何が原因で失効したかは問わず、以降は一律「未ログイン」として扱う）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // F-AC-02 Task3: ログイン中なら最終利用日時を進める（1 時間に 1 回）。未ログインなら古い記録を消す
  // （次にログインした人が前の記録で締め出されないように）
  if (user) {
    if (shouldTouchLastActive(lastActive, now)) {
      response.cookies.set(LAST_ACTIVE_COOKIE, String(now), lastActiveCookieOptions(sessionCookieOptions.secure));
    }
  } else if (lastActive !== null) {
    response.cookies.delete(LAST_ACTIVE_COOKIE);
  }

  // F-AD-05: 一時停止されたアカウント（3.10.5）はセッションを破棄してログイン画面へ。
  // ログイン自体はコールバックで拒否するが、停止前に発行済みのセッションもここで止める。
  // 停止判定は SC-00・SC-01 等の未ログインでも開ける画面では不要なので、ログイン済みの時だけ問い合わせる
  if (user && !request.nextUrl.pathname.startsWith("/api/auth/")) {
    const { data: profile } = await supabase
      .from("users")
      .select("suspended_at")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.suspended_at) {
      await supabase.auth.signOut();
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "account_suspended" }, { status: 401 });
      }
      const loginUrl = new URL("/login?error=suspended", request.url);
      const redirect = NextResponse.redirect(loginUrl);
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }
  }

  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      return new NextResponse(null, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return new NextResponse(null, { status: 404 });
    }
  }

  return response;
}

export const config = {
  // public/配下の静的アセット（画像等）は認証チェック不要のため除外する
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
