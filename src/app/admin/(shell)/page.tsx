import { Suspense } from "react";
import { connection } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { AdminDashboardScreen } from "@/components/admin/AdminDashboardScreen";
import { loadAdminDashboard, type AdminDashboardData } from "@/lib/admin/dashboard";

/*
 * #901: 器を静的に作る対象から外す（instant = false）。
 *
 * 【初心者向け】管理画面は**パソコン前提・ログイン必須**で、開くのは運営だけです。
 * 器を先に配ってもうれしい人がいないうえ、ダッシュボードは `new Date()` など
 * **毎回変わるもの**を素で読んでいます。利用者向けの画面を先に進めるため、ここは外します。
 * 外しても動きは今までどおりです（毎回サーバーで描く）。
 */
export const instant = false;

/**
 * admin-shell-dashboard Task 2: 管理者ダッシュボード（SC-16）
 * 出典: docs/tasks/admin/admin-shell-dashboard/02-dashboard-summary.md
 *
 * アクセス制御は src/proxy.ts（/admin 配下の is_admin 判定・404）に委ね、枠は layout.tsx が付ける。
 * ここは lib/admin/dashboard.ts で数字を集めて AdminDashboardScreen に渡すだけ。
 */
export default function AdminDashboardPage() {
  /*
   * #901: 数字を集める部分を `Suspense` の中に入れ、`connection()` を先に呼ぶ。
   *
   * 【初心者向け】`cacheComponents` を入れると、Next.js は**まず器だけを静的に作ろうと**します。
   * そのとき `new Date()` のように**毎回変わるもの**を読むと、ビルドが止まります
   * （`instant = false` では外せない。同梱ドキュメント migrating-to-cache-components.md の 3）。
   * `connection()` は「ここから先はリクエストが来てから」という合図で、これを先に呼べば
   * 中で日付を読んでも構いません。
   */
  return (
    <Suspense fallback={null}>
      <AdminDashboard />
    </Suspense>
  );
}

async function AdminDashboard() {
  await connection();
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
