import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureUserRecord } from "@/lib/users/ensure-user-record";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getClientIp } from "@/lib/http/client-ip";
import { isWithinRateLimit } from "@/lib/rate-limit/check-rate-limit";

// F-AC-01 Task8: 同一IPから1分間に10回を超える試行を拒否する
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 60;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10;

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const redirectTo = safeRedirectPath(searchParams.get("redirect_to"));
    const consent = searchParams.get("consent");
    // どちらの画面から来たか。SC-01（login）とSC-20（signup）でIdP認証のフローは同一のため、
    // アカウントの有無と合わせてここで分岐する（要件定義書3.2.1、v2.8）
    const isSignupFlow = searchParams.get("mode") === "signup";
    const entryScreen = isSignupFlow ? "/signup" : "/login";

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

    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
        return NextResponse.redirect(`${origin}${entryScreen}?error=1`);
    }

    // F-AC-01 Task4/Task7: アカウントの有無で分岐する。
    // IdP認証が通ってもアプリのアカウントがあるとは限らないため、ここで確認する。
    const { data: existingUser, error: lookupError } = await admin
        .from("users")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

    if (lookupError) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}${entryScreen}?error=1`);
    }

    if (!existingUser) {
        // 未登録。同意を得ていない限りアカウントを作らない。
        // ログイン画面から来た場合は同意欄自体が無いため、必ずここに該当する。
        if (!isSignupFlow) {
            await supabase.auth.signOut();
            return NextResponse.redirect(`${origin}/signup?error=account_not_found`);
        }
        if (consent !== "1") {
            await supabase.auth.signOut();
            return NextResponse.redirect(`${origin}/signup?error=consent_required`);
        }

        try {
            await ensureUserRecord(admin, data.user);
        } catch {
            await supabase.auth.signOut();
            return NextResponse.redirect(`${origin}/signup?error=1`);
        }
    }
    // 登録済みの場合は、どちらの画面から来ても通常のログインとして扱う。
    // consented_atは初回サインアップ時の値を保持する（ensureUserRecordを呼ばない）。

    return NextResponse.redirect(`${origin}${redirectTo}`);
}
