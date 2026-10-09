import { unstable_rethrow } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { AdminDashboardScreen } from "@/components/admin/AdminDashboardScreen";
import { loadAdminDashboard, type AdminDashboardData } from "@/lib/admin/dashboard";

// 数字は毎リクエスト集める（ビルド時に固定しない）
export const dynamic = "force-dynamic";

/**
 * admin-shell-dashboard Task 2: 管理者ダッシュボード（SC-16）
 * 出典: docs/tasks/admin/admin-shell-dashboard/02-dashboard-summary.md
 *
 * アクセス制御は src/proxy.ts（/admin 配下の is_admin 判定・404）に委ね、枠は layout.tsx が付ける。
 * ここは lib/admin/dashboard.ts で数字を集めて AdminDashboardScreen に渡すだけ。
 */
export default async function AdminDashboardPage() {
  let data: AdminDashboardData | null = null;
  try {
    data = await loadAdminDashboard(createAdminClient());
  } catch (error) {
        // #895: Next.js の内部的な合図（redirect / notFound / cookies など）は投げ直す。
    // 握りつぶすと、ビルドログが赤字で埋まったり、転送が黙って効かなくなったりする
    unstable_rethrow(error);
    console.error("[admin] ダッシュボードの集計に失敗しました:", error instanceof Error ? error.message : error);
    data = null;
  }

  if (!data) {
    return <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full" />;
  }
  return <AdminDashboardScreen data={data} />;
}
