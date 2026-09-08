import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { safeRedirectPath } from "@/lib/safe-redirect";

/**
 * F-AC-02 Task3: ログイン必須ページの共通ガード（Server Components向け）
 * 出典: docs/tasks/account/session-management/03-refresh-token-expiry-rule.md
 *
 * セッションが無効（未ログイン・トークン期限切れ・リフレッシュトークン失効いずれも含む）な場合、
 * 元の遷移先をredirect_toとして保持したままログイン画面へ誘導する
 * （F-AC-01のログイン画面のredirect_to機構と連携し、再ログイン後に復帰できる）。
 */
export async function requireUserOrRedirect(
  supabase: SupabaseClient,
  currentPath: string
): Promise<User> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectTo = safeRedirectPath(currentPath);
    redirect(`/login?redirect_to=${encodeURIComponent(redirectTo)}`);
  }

  return user;
}
