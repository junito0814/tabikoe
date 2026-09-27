import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminBadgeCounts } from "@/components/admin/admin-menu-config";

/**
 * admin-shell-dashboard Task 1: メニューの赤い丸に出す件数
 * 出典: docs/tasks/admin/admin-shell-dashboard/01-admin-shell.md
 *       要件定義書 3.10.2（通報・非公開に未対応の件数）
 *
 * 【初心者向け】`count: "exact", head: true` は「行の中身は要らない、件数だけ数えて」という指定。
 * 通報の「未対応」は 未確認（unconfirmed）＋確認中（in_review）（3.8.1）。
 * 「非公開のもの」の確認待ち（自動で非公開になったもの）は strike-system Task 3（#553）で `auto_hidden_at` が
 * 入ってから数える。それまでは 0 のまま（丸は出ない）。
 */
export async function countAdminBadges(admin: SupabaseClient): Promise<AdminBadgeCounts> {
  const { count } = await admin
    .from("reports")
    .select("id", { count: "exact", head: true })
    .in("status", ["unconfirmed", "in_review"]);
  return { reports: count ?? 0, hidden: 0 };
}
