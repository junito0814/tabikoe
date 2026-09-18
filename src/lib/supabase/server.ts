/**
 * サーバー側（Server Component / Route Handler）用の Supabase クライアント
 * 出典: docs/tasks/account/session-management/01-session-verification-middleware.md
 *
 * 【初心者向け】ログイン状態は Cookie に入っている。サーバーで動くコードはブラウザの Cookie を
 * 直接は見られないので、Next.js の `cookies()` から取り出して Supabase に渡す。
 * `getAll` は Cookie を読む口、`setAll` はトークンが更新されたときに Cookie を書き換える口。
 * Server Component から呼ばれた場合は書き換えが禁止されているため、書き換えは proxy.ts に任せて無視する。
 */
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
