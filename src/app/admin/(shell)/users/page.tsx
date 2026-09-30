import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { UserListScreen } from "@/components/admin/UserListScreen";
import { listAdminUsers, parseUserListQuery } from "@/lib/admin/users";

export const dynamic = "force-dynamic";

/**
 * user-management Task 1: 利用者一覧（SC-24）
 * 出典: docs/tasks/admin/user-management/01-user-list.md
 *
 * ダッシュボードの「仮停止の確認待ち」は `?status=provisional` で来るので、URL のクエリを初期の絞り込みにする。
 */
export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const raw = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") raw.set(key, value);
  }
  const query = parseUserListQuery(raw);
  let page: Awaited<ReturnType<typeof listAdminUsers>> | null = null;
  try {
    page = await listAdminUsers(createAdminClient(), { ...query, offset: 0 });
  } catch {
    page = null;
  }
  if (!page) {
    return <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full" />;
  }
  return <UserListScreen initialPage={page} initialQuery={{ ...query, offset: 0 }} />;
}
