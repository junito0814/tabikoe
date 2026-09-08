import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * F-AC-01 Task8: ログイン試行のレート制限の共通関数
 * 出典: docs/tasks/account/signup-login/08-login-rate-limiting.md
 *
 * public.check_rate_limit()（固定ウィンドウ・DBベース）を呼び出す薄いラッパー。
 * F-PO-01（投稿作成レート制限）等、他の用途でも同じテーブル・関数を再利用できる。
 */
export async function isWithinRateLimit(
  admin: SupabaseClient,
  subject: string,
  actionType: string,
  windowSeconds: number,
  limit: number
): Promise<boolean> {
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_subject: subject,
    p_action_type: actionType,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  return data === true;
}
