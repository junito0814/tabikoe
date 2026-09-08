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

    if (!code) {
        return NextResponse.redirect(`${origin}/login?error=1`);
    }

    const admin = createAdminClient();

    // F-AC-01 Task8: コード交換の前に判定し、レート制限中はSupabase Authへの呼び出し自体を避ける
    const allowed = await isWithinRateLimit(
        admin,
        getClientIp(request),
        "login",
        LOGIN_RATE_LIMIT_WINDOW_SECONDS,
        LOGIN_RATE_LIMIT_MAX_ATTEMPTS
    );
    if (!allowed) {
        // このエンドポイントはGoogleからのリダイレクト先であり、
        // 自前のログイン画面へ組み込まれたUIコンポーネントからの呼び出しではないため、
        // ここでは429を直接返す（画面遷移を伴わないAPI的な位置づけ）。
        return new NextResponse("Too Many Requests", { status: 429 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
        return NextResponse.redirect(`${origin}/login?error=1`);
    }

    // F-AC-01 Task7: 同意なしでは（Supabase Auth自体のセッションは成立していても）
    // アプリのユーザーレコードは作成せず、ログイン状態も解除する
    if (consent !== "1") {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=consent_required`);
    }

    try {
        await ensureUserRecord(admin, data.user);
    } catch {
        return NextResponse.redirect(`${origin}/login?error=1`);
    }

    return NextResponse.redirect(`${origin}${redirectTo}`);
}
