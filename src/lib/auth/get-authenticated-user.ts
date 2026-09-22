import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthUserFromClaims, type AuthUser } from "./auth-user";

/**
 * Route Handler 共通: ログイン中の利用者（id・email）を返す。未ログインなら null
 * performance Task1（2026-09-22）: `getUser()`（毎回 Supabase Auth へ通信）から `getClaims()`（手元で署名検証）に変更。
 * Google の表示名などが要る所（新規登録 API）は `supabase.auth.getUser()` を直接使う。
 */
export async function getAuthenticatedUser(supabase: SupabaseClient): Promise<AuthUser | null> {
  return getAuthUserFromClaims(supabase);
}
