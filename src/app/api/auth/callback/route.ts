import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertSupabaseEnv } from "@/lib/supabase/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureUserRecord } from "@/lib/users/ensure-user-record";
import { safeRedirectPath } from "@/lib/safe-redirect";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const redirectTo = safeRedirectPath(searchParams.get("redirect_to"));

    if (!code) {
        return NextResponse.redirect(`${origin}/login?error=1`);
    }

    assertSupabaseEnv();
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                },
            },
        }
    );
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
        return NextResponse.redirect(`${origin}/login?error=1`);
    }

    try {
        await ensureUserRecord(createAdminClient(), data.user);
    } catch {
        return NextResponse.redirect(`${origin}/login?error=1`);
    }

    return NextResponse.redirect(`${origin}${redirectTo}`);
}