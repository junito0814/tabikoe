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
