import { createClient } from "@supabase/supabase-js";
import { assertSupabaseAdminEnv } from "./env";

/**
 * Service Role KeyでRLSを回避するクライアント。
 * Route Handlers内でのみ使用し、ブラウザ側のコードから呼び出さないこと。
 *
 * 【初心者向け】RLS（Row Level Security）は「誰がどの行を読める・書けるか」を DB 側で縛る仕組み。
 * このクライアントはそれを素通りする「管理者権限」なので、使う前に必ず getAuthenticatedUser で本人確認し、
 * 「この人のデータだけ」を自分で絞ること。`SUPABASE_SECRET_KEY` は NEXT_PUBLIC_ が付かない＝ブラウザには配られない。
 * autoRefreshToken / persistSession を false にしているのは、サーバー側でセッションを保持する必要が無いから。
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
