import { createClient } from "@/lib/supabase/server";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { BadgeScreen } from "@/components/badges/BadgeScreen";
import { getBadgeStatuses, type BadgeStatus } from "@/lib/badges/badge-status";

/**
 * SC-10 ステータスバッジ画面
 * 出典: docs/tasks/badges/status-badges/04-badge-screen-ui.md
 *
 * ログイン必須（4.1）。マイページ（SC-06, Phase 7）からの導線は my-page Task4 で置く。
 */
export default async function BadgesPage() {
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, "/badges");

  let badges: BadgeStatus[] | null = null;
  try {
    badges = await getBadgeStatuses(supabase, user.id);
  } catch {
    badges = null;
  }

  if (badges === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  return <BadgeScreen badges={badges} />;
}
