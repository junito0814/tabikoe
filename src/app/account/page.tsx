import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import DisplayNameForm from "./display-name-form";
import AvatarUploadForm from "./avatar-upload-form";
import LogoutButton from "./logout-button";
import DeleteAccountDialog from "./delete-account-dialog";
import { BlockedUsersList, type BlockedUser } from "@/components/blocks/BlockedUsersList";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * プロフィール編集画面（SC-07）
 * 出典: docs/tasks/account/profile-edit/00-index.md, docs/tasks/account/logout/00-index.md,
 *       docs/tasks/account/account-deletion/00-index.md
 *
 * 現時点ではユーザー名編集・アイコン変更・ログアウト・退会のみを扱う。
 * 画面共通のメニューバー導線（shared-ui/menu-bar）はまだ実装されていない。
 */
export default async function AccountPage() {
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, "/account");

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("display_name, avatar_url, is_admin")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  // F-SF-02 Task3: ブロック中のユーザー一覧。blocks は本人が blocker の行をRLSで読めるが、
  // 相手の表示名・アイコンは users の他人行なので service_role で引く
  const admin = createAdminClient();
  const { data: blockRows } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", user.id)
    .order("created_at", { ascending: false });
  const blockedIds = (blockRows ?? []).map((row) => row.blocked_id);
  let blockedUsers: BlockedUser[] = [];
  if (blockedIds.length > 0) {
    const { data: blockedProfiles } = await admin
      .from("users")
      .select("id, display_name, avatar_url")
      .in("id", blockedIds);
    const byId = new Map((blockedProfiles ?? []).map((row) => [row.id, row]));
    blockedUsers = blockedIds.flatMap((blockedId) => {
      const row = byId.get(blockedId);
      return row
        ? [{ id: row.id, displayName: row.display_name ?? "ユーザー", avatarUrl: row.avatar_url }]
        : [];
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-app px-6 py-16">
      <h1 className="text-[16px] font-bold text-ink">アカウント</h1>

      <AvatarUploadForm initialAvatarUrl={profile?.avatar_url ?? null} />
      <DisplayNameForm initialDisplayName={profile?.display_name ?? ""} />

      {/* menu-bar Task3: 管理画面への導線はメニューバーには置かず、is_adminユーザーにだけここで出す（4.2、3.10.1） */}
      {profile?.is_admin && (
        <Link
          href="/admin"
          className="flex h-11 w-full max-w-[360px] items-center justify-center rounded-[10px] border border-line bg-surface text-[14px] font-semibold text-ink"
        >
          管理者ダッシュボード
        </Link>
      )}

      <div className="w-full max-w-[360px] border-t border-line pt-6">
        <BlockedUsersList initialBlockedUsers={blockedUsers} />
      </div>

      <div className="flex w-full max-w-[360px] flex-col items-center gap-4 border-t border-line pt-6">
        <LogoutButton />
        <DeleteAccountDialog isAdmin={profile?.is_admin ?? false} />
      </div>
    </div>
  );
}
