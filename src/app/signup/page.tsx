import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SignupConsentScreen } from "@/components/auth/SignupConsentScreen";
import { safeRedirectPath } from "@/lib/safe-redirect";

/**
 * SC-20 同意画面（signup-login Task11、2026-09-22）
 * 出典: docs/tasks/account/signup-login/11-google-once-signup.md
 *
 * 【初心者向け】3 つの状態で出し分ける。
 *   - 未認証（Google の認証がまだ）→ ログイン画面へ（入口は SC-01 の「Google で続ける」1 つ）
 *   - 登録済み → ホームへ（この画面は要らない）
 *   - 認証済みだが未登録（登録待ち）→ 同意画面
 */
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ redirect_to?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existing } = await createAdminClient().from("users").select("id").eq("id", user.id).maybeSingle();
  if (existing) redirect("/");

  const { redirect_to } = await searchParams;
  const redirectTo = redirect_to ? safeRedirectPath(redirect_to) : null;
  return <SignupConsentScreen email={user.email ?? ""} redirectTo={redirectTo} />;
}
