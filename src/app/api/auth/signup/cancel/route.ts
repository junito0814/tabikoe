import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

/**
 * signup-login Task11（2026-09-22）: 同意画面（SC-20）の「やめる」
 * 出典: docs/tasks/account/signup-login/11-google-once-signup.md
 *
 * 【初心者向け】同意せずにやめた人の認証記録（Supabase Auth 側のユーザー）は残さない。
 * users 行が無い（登録待ち）ときだけ Auth のユーザーを消し、セッションも捨てる。登録済みなら何もしない。
 * 未ログインで呼ばれてもエラーにせず正常終了（ログアウトと同じ扱い）。
 */
export async function POST() {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return NextResponse.json({ ok: true });
  }
  const admin = createAdminClient();
  const { data: existing } = await admin.from("users").select("id").eq("id", user.id).maybeSingle();
  if (!existing) {
    await supabase.auth.signOut();
    await admin.auth.admin.deleteUser(user.id);
    return NextResponse.json({ ok: true, deleted: true });
  }
  return NextResponse.json({ ok: true, deleted: false });
}
