import { createClient } from "@supabase/supabase-js";
import { assertSupabaseAdminEnv } from "./env";

/**
 * Service Role KeyでRLSを回避するクライアント。
 * Route Handlers内でのみ使用し、ブラウザ側のコードから呼び出さないこと。
 */
export function createAdminClient() {
    assertSupabaseAdminEnv();
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}
