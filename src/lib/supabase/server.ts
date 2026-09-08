import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { assertSupabaseEnv } from "./env";
import { sessionCookieOptions } from "./cookie-options";

export async function createClient() {
    assertSupabaseEnv();
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookieOptions: sessionCookieOptions,
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // Server Component内から呼ばれた場合はCookieを変更できない。
                        // src/proxy.tsが全ページで走り、トークンリフレッシュ時のCookie再設定を担うため無視してよい。
                    }
                },
            },
        }
    );
}
