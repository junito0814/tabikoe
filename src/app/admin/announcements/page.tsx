import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { AnnouncementManager, type Announcement } from "@/components/admin/AnnouncementManager";

// 管理データは毎リクエスト取得する（ビルド時に固定しない）
export const dynamic = "force-dynamic";

/**
 * SC-17 お知らせ管理画面
 * 出典: docs/tasks/admin/announcement-management/03-announcement-management-ui.md
 *
 * アクセス制御は src/proxy.ts（/admin 配下の is_admin 判定・404）に委ねる。
 */
export default async function AdminAnnouncementsPage() {
  const { data, error } = await createAdminClient()
    .from("system_announcements")
    .select("id, title, body, published_at, created_at, updated_at")
    .order("published_at", { ascending: false });

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  return <AnnouncementManager initialAnnouncements={(data ?? []) as Announcement[]} />;
}
