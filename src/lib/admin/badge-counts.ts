import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminBadgeCounts } from "@/components/admin/admin-menu-config";

/**
 * admin-shell-dashboard Task 1: メニューの赤い丸に出す件数
 * 出典: docs/tasks/admin/admin-shell-dashboard/01-admin-shell.md
 *       要件定義書 3.10.2（通報・非公開に未対応の件数）
 *
 * 【初心者向け】`count: "exact", head: true` は「行の中身は要らない、件数だけ数えて」という指定。
 * 通報の「未対応」は 未確認（unconfirmed）＋確認中（in_review）（3.8.1）。
 * 「非公開のもの」の確認待ちは、自動で隠れたまま（hidden_reason = 'auto'）の投稿・コメント（strike-system Task 3）。
 */
export async function countAdminBadges(admin: SupabaseClient): Promise<AdminBadgeCounts> {
  const counting = (table: string) => admin.from(table).select("id", { count: "exact", head: true });
  const [reports, autoPosts, autoComments] = await Promise.all([
    counting("reports").in("status", ["unconfirmed", "in_review"]),
    counting("posts").eq("hidden_reason", "auto"),
    counting("comments").eq("hidden_reason", "auto"),
  ]);
  return { reports: reports.count ?? 0, hidden: (autoPosts.count ?? 0) + (autoComments.count ?? 0) };
}
