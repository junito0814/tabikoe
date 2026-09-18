import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * F-AC-02 Task1: セッション検証の共通ユーティリティ（Route Handlers向け）
 * 出典: docs/tasks/account/session-management/01-session-verification-middleware.md
 *
 * 各Route Handlerで同じ`auth.getUser()`呼び出し・エラーハンドリングを重複させないための共通関数。
 * トークンが存在しない・無効・期限切れ（リフレッシュも失敗）のいずれの場合もnullを返す。
 *
 * 【初心者向け】Route Handler の先頭で `const user = await getAuthenticatedUser(supabase)` と書き、
 * null なら 401 を返すのが定型。`auth.getUser()` は Supabase のサーバーにトークンを問い合わせて本物か確かめるので、
 * Cookie を書き換えただけの偽装は通らない。
 */
export async function getAuthenticatedUser(supabase: SupabaseClient): Promise<User | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}
