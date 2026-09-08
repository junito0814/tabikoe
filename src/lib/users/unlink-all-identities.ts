import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 退会時、ユーザーの全IdP連携を解除する（F-AC-05 Task1の受入条件）。
 * Supabase Authは最後の1件のIdP連携は解除できない仕様のため、失敗は無視する
 * （is_deleted=true設定とセッション無効化により、いずれにせよ実質ログイン不可能になる）。
 * セッションが有効なうちに呼び出す必要があるため、呼び出し元でsignOutより前に実行すること。
 */
export async function unlinkAllIdentities(supabase: SupabaseClient): Promise<void> {
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error || !data) {
    return;
  }

  for (const identity of data.identities) {
    try {
      await supabase.auth.unlinkIdentity(identity);
    } catch {
      // 最後の1件は解除できない仕様のため無視する
    }
  }
}
