import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { UserDetailScreen } from "@/components/admin/UserDetailScreen";
import { getAdminUserDetail, type AdminUserDetail } from "@/lib/admin/user-detail";

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
 * user-management Task 2: 利用者詳細（SC-24 詳細）
 * 出典: docs/tasks/admin/user-management/02-user-detail-actions.md
 */
export default async function AdminUserDetailPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  let user: AdminUserDetail | null = null;
  let failed = false;
  try {
    user = await getAdminUserDetail(createAdminClient(), id);
  } catch {
    failed = true;
  }
  if (failed) {
    return <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full" />;
  }
  if (!user) {
    notFound();
  }
  return <UserDetailScreen user={user} />;
}
