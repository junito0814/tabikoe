import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { AccountStatusScreen } from "@/components/account/AccountStatusScreen";
import { getAccountStatus, type AccountStatus } from "@/lib/moderation/account-status";
import { ContentEnter } from "@/components/transitions/Reveal";

export const dynamic = "force-dynamic";

/**
 * strike-system Task 5: アカウントの状態（SC-28）
 * 出典: docs/tasks/safety/strike-system/05-account-status.md
 *
 * マイページから開く。通知（moderation_action・account_*）のタップ先でもある。ログイン必須
 */
export default async function AccountStatusPage() {
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, "/account/status");
  let status: AccountStatus | null = null;
  try {
    status = await getAccountStatus(createAdminClient(), user.id);
  } catch {
    status = null;
  }
  if (!status) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }
  return (
    <ContentEnter>
      <AccountStatusScreen status={status} />
    </ContentEnter>
  );
}
