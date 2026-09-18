/**
 * ブラウザ（クライアントコンポーネント）用の Supabase クライアント
 *
 * 【初心者向け】Supabase へ接続する「窓口」は 3 種類ある。
 *   - client.ts  … ブラウザで動くコード用（"use client" のコンポーネント）。公開してよい publishable キーを使う
 *   - server.ts  … サーバー側（Server Component / Route Handler）用。Cookie からログイン状態を読む
 *   - admin.ts   … サーバー専用の service_role キー。RLS（行レベルの権限）を通らないので、必ず本人確認の後に使う
 * このファイルは 1 番目。RLS が効くので、ログイン中のユーザーに許された行しか見えない。
 * 現状ほとんどの画面は Route Handler 経由で DB を読むため、直接ここを使う場面は少ない。
 */
import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseEnv } from "./env";

export function createClient() {
    assertSupabaseEnv();
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );
}