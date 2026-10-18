import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { AnnouncementManager, type Announcement } from "@/components/admin/AnnouncementManager";

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
