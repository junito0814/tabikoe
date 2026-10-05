import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { MyPageScreen } from "@/components/mypage/MyPageScreen";
import { DEFAULT_AVATAR_URL } from "@/lib/users/constants";
import { getMyPageSummary, getMyPosts, getMyTripOptions } from "@/lib/users/my-page";
import { getMyDrafts } from "@/lib/posts/drafts";
import { getPostingRestrictionUntil } from "@/lib/moderation/posting-restriction";
import { ContentEnter } from "@/components/transitions/Reveal";

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
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  return (
    <ContentEnter>
      {/* #682: 投稿一覧と下書きは「投稿履歴」（/mymap）へ移した */}
      <MyPageScreen
        profile={data.profile}
        summary={data.summary}
        wishlistCount={data.wishlistCount}
        restrictedUntil={data.restrictedUntil}
      />
    </ContentEnter>
  );
}

async function loadMyPageData(admin: ReturnType<typeof createAdminClient>, userId: string) {
  try {
    const [profile, summary, initialPosts, tripOptions, drafts, wishlist, restrictedUntil] = await Promise.all([
      admin.from("users").select("display_name, avatar_url, is_admin").eq("id", userId).maybeSingle(),
      getMyPageSummary(admin, userId),
      getMyPosts(admin, userId, null, 0),
      getMyTripOptions(admin, userId),
      // v3.0: 下書き（先頭の段）。取れなくてもページは出す
      getMyDrafts(admin, userId).catch((): { drafts: []; total: number } => ({ drafts: [], total: 0 })),
      admin.from("wishlist").select("id", { count: "exact", head: true }).eq("user_id", userId),
      // strike-system Task 5: 投稿禁止中なら先頭に帯を出す
      getPostingRestrictionUntil(admin, userId),
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
      drafts,
      wishlistCount: wishlist.count ?? 0,
      restrictedUntil,
    };
  } catch {
    return null;
  }
}
