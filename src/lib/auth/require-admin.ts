import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "./get-authenticated-user";

/**
 * F-AD-01: 管理者用 Route Handler の共通ガード
 * 出典: docs/tasks/admin/admin-login/01-admin-route-middleware.md
 *       要件定義書3.10.1（is_admin が false または未ログインなら404）
 *
 * /admin 配下の画面は src/proxy.ts が 404 にするが、/api/admin 配下は proxy の対象外なので
 * 各 Route Handler がこの関数で判定する。存在自体を露出させないため、未ログインも非管理者も null。
 */
export async function requireAdminUser(
  supabase: SupabaseClient,
  admin: SupabaseClient
): Promise<User | null> {
  const user = await getAuthenticatedUser(supabase);
  if (!user) return null;

  const { data } = await admin.from("users").select("is_admin").eq("id", user.id).maybeSingle();
  return data?.is_admin ? user : null;
}
