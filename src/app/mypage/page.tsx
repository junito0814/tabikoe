import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { MyPageScreen } from "@/components/mypage/MyPageScreen";
import { DEFAULT_AVATAR_URL } from "@/lib/users/constants";
import { getMyPageSummary, getMyPosts, getMyTripOptions } from "@/lib/users/my-page";

/**
 * SC-06 マイページ
 * 出典: docs/tasks/records/my-page/00-index.md
 *       要件定義書3.6.1
 *
 * メニューバーの「マイページ」から開く。ログイン必須。
 */
export default async function MyPage() {
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, "/mypage");

  const admin = createAdminClient();
  const data = await loadMyPageData(admin, user.id);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF6F0] px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  return (
    <MyPageScreen
      profile={data.profile}
      summary={data.summary}
      initialPosts={data.initialPosts}
      tripOptions={data.tripOptions}
    />
  );
}

async function loadMyPageData(admin: ReturnType<typeof createAdminClient>, userId: string) {
  try {
    const [profile, summary, initialPosts, tripOptions] = await Promise.all([
      admin.from("users").select("display_name, avatar_url, is_admin").eq("id", userId).maybeSingle(),
      getMyPageSummary(admin, userId),
      getMyPosts(admin, userId, null, 0),
      getMyTripOptions(admin, userId),
    ]);
    if (profile.error) throw profile.error;
    return {
      profile: {
        displayName: profile.data?.display_name ?? "ユーザー",
        avatarUrl: profile.data?.avatar_url ?? DEFAULT_AVATAR_URL,
        isAdmin: profile.data?.is_admin ?? false,
      },
      summary,
      initialPosts,
      tripOptions,
    };
  } catch {
    return null;
  }
}
