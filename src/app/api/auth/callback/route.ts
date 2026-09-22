/**
 * F-AC-01 Task4〜8: Google ログインのコールバック（GET /api/auth/callback）
 * 出典: docs/tasks/account/signup-login/04-auth-callback-handler.md ほか
 *
 * 【初心者向け】ログインの流れは次の 3 段階。
 *   1. 画面（SC-01 / SC-20）のボタン → Google の認証ページへ移動
 *   2. Google が認証を終えると、このURLに `?code=...` を付けて戻してくる
 *   3. ここで code をセッション（Cookie）に交換し、アプリ側のアカウント有無を確認して遷移先へ送る
 * つまり「Google で本人確認 OK」と「タビコエにアカウントがある」は別物で、後者はこのファイルで判定する。
 * 未登録ならセッションを保持したまま同意画面（/signup）へ送り、そこでアカウントを作る（Task11。Google は 1 回だけ）。
 * 失敗時は必ずログイン画面（/login）へ `?error=` 付きで戻し、白い画面を出さない。
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getClientIp } from "@/lib/http/client-ip";
import { isWithinRateLimit } from "@/lib/rate-limit/check-rate-limit";
import { recordOperation } from "@/lib/logs/record-operation";
import { resolvePostLoginRedirect } from "@/lib/auth/post-login-redirect";

// F-AC-01 Task8: 同一IPから1分間に10回を超える試行を拒否する
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 60;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10;


export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const redirectTo = safeRedirectPath(searchParams.get("redirect_to"));
    // Task11（2026-09-22）: 入口はログイン画面（SC-01）の「Google で続ける」1 つ。失敗時は必ずそこへ戻す
    const entryScreen = "/login";
    // F-AD-01 Task2: 管理者ログイン画面（SC-15 = /login?admin=1）経由か
    const fromAdminLogin = searchParams.get("admin") === "1";

    if (!code) {
        return NextResponse.redirect(`${origin}${entryScreen}?error=1`);
    }

    const admin = createAdminClient();

    // F-AC-01 Task8: コード交換の前に判定し、レート制限中はSupabase Authへの呼び出し自体を避ける
    let allowed: boolean;
    try {
        allowed = await isWithinRateLimit(
            admin,
            getClientIp(request),
            "login",
            LOGIN_RATE_LIMIT_WINDOW_SECONDS,
            LOGIN_RATE_LIMIT_MAX_ATTEMPTS
        );
    } catch {
        // レート制限の判定自体が失敗した場合（DB障害・マイグレーション未適用等）は、
        // セキュリティ機構を黙って無効化せずログインを中断する。
        // この後のユーザーレコード作成にも同じDBが必要なため、どのみち完了できない。
        return NextResponse.redirect(`${origin}${entryScreen}?error=1`);
    }

    if (!allowed) {
        // このエンドポイントはGoogleからのリダイレクト先であり、
        // 自前のログイン画面へ組み込まれたUIコンポーネントからの呼び出しではないため、
        // ここでは429を直接返す（画面遷移を伴わないAPI的な位置づけ）。
        return new NextResponse("Too Many Requests", { status: 429 });
    }

    // Google から受け取った一時的な code を、ログイン状態（アクセストークン＋リフレッシュトークン）に交換する。
    // createClient() は Cookie を読み書きできる Supabase クライアントなので、ここでセッションが Cookie に保存される
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
        // 要件7.5: ログイン失敗。ユーザーは確定していないのでuser_idは持たない
        await recordOperation(admin, {
            actionType: "login_failure",
            detail: { reason: "code_exchange_failed", clientIp: getClientIp(request) },
        });
        return NextResponse.redirect(`${origin}${entryScreen}?error=1`);
    }

    // F-AC-01 Task4/Task7: アカウントの有無で分岐する。
    // IdP認証が通ってもアプリのアカウントがあるとは限らないため、ここで確認する。
    const { data: existingUser, error: lookupError } = await admin
        .from("users")
        .select("id, is_admin, suspended_at")
        .eq("id", data.user.id)
        .maybeSingle();

    if (lookupError) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}${entryScreen}?error=1`);
    }

    if (!existingUser) {
        // signup-login Task11（2026-09-22）: 未登録。同意を得ていないのでアカウントは作らないが、
        // Google の認証状態（セッション）は捨てずに同意画面（SC-20）へ送る。こうすると Google のアカウント選択が
        // 1 回で済む。アカウント作成は SC-20 の「同意してはじめる」→ POST /api/auth/signup が行う。
        // この「登録待ち」の状態で他の画面を開けないようにするのは proxy.ts の役目。
        await recordOperation(admin, {
            actionType: "login_failure",
            detail: { reason: "account_not_found", next: "consent" },
        });
        const consentUrl = new URL("/signup", origin);
        if (redirectTo !== "/") consentUrl.searchParams.set("redirect_to", redirectTo);
        return NextResponse.redirect(consentUrl.toString());
    }
    // 登録済みなら通常のログイン。consented_at は初回サインアップ時の値を保持する（ensureUserRecord を呼ばない）。

    // F-AD-05: 通報対応でアカウントを一時停止されたユーザーはログインできない（3.10.5）
    if (existingUser?.suspended_at) {
        await supabase.auth.signOut();
        await recordOperation(admin, {
            actionType: "login_failure",
            userId: data.user.id,
            detail: { reason: "account_suspended" },
        });
        return NextResponse.redirect(`${origin}/login?error=suspended`);
    }

    // 要件7.5: ログイン成功（新規作成直後のログインも含む）
    await recordOperation(admin, {
        actionType: "login_success",
        userId: data.user.id,
        detail: { flow: "login" },
    });

    // F-AD-01 Task2: 管理者ログイン導線から来た管理者はダッシュボードへ
    const destination = resolvePostLoginRedirect({
        fromAdminLogin,
        isAdmin: existingUser?.is_admin ?? false,
        redirectTo,
    });
    return NextResponse.redirect(`${origin}${destination}`);
}
