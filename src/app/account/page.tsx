import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DisplayNameForm from "./display-name-form";
import AvatarUploadForm from "./avatar-upload-form";
import LogoutButton from "./logout-button";
import DeleteAccountDialog from "./delete-account-dialog";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, avatar_url, is_admin")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-[#FBF6F0] px-6 py-16">
      <h1 className="text-[16px] font-bold text-[#3D3A35]">アカウント</h1>

      <AvatarUploadForm initialAvatarUrl={profile?.avatar_url ?? null} />
      <DisplayNameForm initialDisplayName={profile?.display_name ?? ""} />

      <div className="flex w-full max-w-[360px] flex-col items-center gap-4 border-t border-[#E8E1D8] pt-6">
        <LogoutButton />
        <DeleteAccountDialog isAdmin={profile?.is_admin ?? false} />
      </div>
    </div>
  );
}
