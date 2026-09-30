import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { AdminMfaScreen } from "@/components/admin/AdminMfaScreen";
import { safeAdminRedirect } from "@/lib/admin/mfa-redirect";

export const dynamic = "force-dynamic";

/**
 * admin-login Task 5: 管理者の二段階確認（SC-32）
 * 出典: docs/tasks/admin/admin-login/05-mfa-screen.md
 *       要件定義書 3.10.1・4.1（SC-32）
 *
 * 【初心者向け】このページは `src/app/admin/` の直下に置いてあるが、
 * ほかの管理画面は `src/app/admin/(shell)/` の中にある。括弧付きのフォルダ（ルートグループ）は
 * URL に出ないので `/admin/reports` などのアドレスは変わらないまま、**左メニューの layout.tsx を
 * そのグループの中だけに効かせられる**。おかげでこの画面にはメニューが付かない（要件 4.2）。
 *
 * 関所（Task 6）がここへ送ってくるが、直接 URL を開かれても自分で確かめる：
 * 管理者でなければ 404、既に通っているなら元の行き先へ返す。
 */
export default async function AdminMfaPage({ searchParams }: PageProps<"/admin/mfa">) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = await requireAdminUser(supabase, admin);
  if (!user) notFound();

  const params = await searchParams;
  const redirectTo = safeAdminRedirect(params.redirect_to);

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasFactor = (factors?.totp.length ?? 0) > 0;

  // 既に 6 桁まで通っているセッションが直接開いたときは、用が無いので元の行き先へ戻す。
  // 60 分を過ぎているかどうかは関所（Task 6）が見るので、ここでは aal だけを見る
  if (hasFactor) {
    const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (level?.currentLevel === "aal2" && params.redirect_to) redirect(redirectTo);
  }

  return <AdminMfaScreen mode={hasFactor ? "verify" : "enroll"} redirectTo={redirectTo} />;
}
