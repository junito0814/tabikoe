import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeleteAccountDialog from "./delete-account-dialog";

/**
 * プロフィール編集画面（SC-07, F-AC-04）が未実装のため、
 * 退会導線（F-AC-05 Task4）を暫定的にホストする最小限のページ。
 * SC-07実装時はそちらに統合する。
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
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#FBF6F0] px-6">
      <h1 className="text-[16px] font-bold text-[#3D3A35]">アカウント</h1>
      <DeleteAccountDialog isAdmin={profile?.is_admin ?? false} />
    </div>
  );
}
