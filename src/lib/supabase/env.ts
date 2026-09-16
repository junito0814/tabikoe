/**
 * Supabase 接続に必要な環境変数（.env.local）の存在チェック
 *
 * 【初心者向け】環境変数が足りないまま動かすと、原因の分かりにくいエラーになる。
 * ここで先に名前入りのエラーを投げて「何が無いか」をはっきりさせる。
 *   - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY … ブラウザにも配られる公開情報
 *   - SUPABASE_SECRET_KEY … サーバー専用（RLS を通らない鍵）。ブラウザに出してはいけない
 */
export function assertSupabaseEnv(): void {
    const missing: string[] = [];
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        missing.push("NEXT_PUBLIC_SUPABASE_URL");
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
        missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    }
    if (missing.length > 0) {
        throw new Error(
            `Missing required Supabase environment variables: ${missing.join(", ")}`
        );
    }
}

/**
 * Service Role Keyを使う管理者クライアント用の環境変数チェック。
 * このキーはRLSを回避するため、ブラウザに渡らないRoute Handlers内でのみ使用すること。
 */
export function assertSupabaseAdminEnv(): void {
    assertSupabaseEnv();
    if (!process.env.SUPABASE_SECRET_KEY) {
        throw new Error(
            "Missing required Supabase environment variable: SUPABASE_SECRET_KEY"
        );
    }
}
