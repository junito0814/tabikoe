import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { NotificationListScreen } from "@/components/notifications/NotificationListScreen";
import { getNotificationFeed, type FeedPage } from "@/lib/notifications/feed";
import { ContentEnter } from "@/components/transitions/Reveal";

// #785: ブラウザのタブ名（「通知 | タビコエ」）
export const metadata = { title: "通知" };

/**
 * SC-14 通知一覧画面
 * 出典: docs/tasks/notifications/notification-list/02-notification-list-ui.md
 *
 * メニューバーの「通知」から開く。ログイン必須。1ページ目はここで取得し、以降は GET /api/notifications。
 */
export default async function NotificationsPage() {
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, "/notifications");

  let initialPage: FeedPage | null = null;
  try {
    initialPage = await getNotificationFeed(createAdminClient(), user.id, 0);
  } catch {
    initialPage = null;
  }

  if (!initialPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  return (
    <ContentEnter>
      <NotificationListScreen initialPage={initialPage} />
    </ContentEnter>
  );
}
