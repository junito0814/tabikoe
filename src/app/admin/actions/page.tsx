import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { AdminActionsScreen } from "@/components/admin/AdminActionsScreen";
import { listAdminActions, parseAdminActionFilters } from "@/lib/admin/admin-actions";

// 記録は毎リクエスト取得する
export const dynamic = "force-dynamic";

/**
 * user-management Task 4: 操作の記録（SC-27）
 * 出典: docs/tasks/admin/user-management/04-admin-actions-log.md
 *
 * アクセス制御は src/proxy.ts（/admin 配下の is_admin 判定・404）に委ねる。
 * 1 ページ目と「管理者」の候補（is_admin の利用者）をサーバーで取り、続きは /api/admin/actions から。
 */
export default async function AdminActionsPage() {
  const admin = createAdminClient();
  let loaded: { page: Awaited<ReturnType<typeof listAdminActions>>; admins: { id: string; name: string }[] } | null = null;
  try {
    const [page, admins] = await Promise.all([
      listAdminActions(admin, parseAdminActionFilters(new URLSearchParams()), 0),
      admin.from("users").select("id, display_name").eq("is_admin", true).order("display_name"),
    ]);
    loaded = {
      page,
      admins: (admins.data ?? []).map((u) => ({ id: u.id as string, name: (u.display_name as string | null) ?? "（名前なし）" })),
    };
  } catch {
    loaded = null;
  }

  if (!loaded) {
    return <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full" />;
  }
  return <AdminActionsScreen initialPage={loaded.page} admins={loaded.admins} />;
}
