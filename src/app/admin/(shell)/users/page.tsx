import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { UserListScreen } from "@/components/admin/UserListScreen";
import { listAdminUsers, parseUserListQuery } from "@/lib/admin/users";

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
