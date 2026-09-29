import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { UserDetailScreen } from "@/components/admin/UserDetailScreen";
import { getAdminUserDetail, type AdminUserDetail } from "@/lib/admin/user-detail";

export const dynamic = "force-dynamic";

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
