import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { unlinkAllIdentities } from "@/lib/users/unlink-all-identities";
import { recordOperation } from "@/lib/logs/record-operation";

/**
 * F-AC-05: 退会実行 Route Handler
 * 出典: docs/tasks/account/account-deletion/01-deactivation-handler.md
 *       docs/tasks/account/account-deletion/03-admin-handover-confirmation.md
 *
 * ユーザー匿名化・関連データ削除・アルバムオーナー継承は
 * public.deactivate_user() （1トランザクション）に集約している。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("is_admin, is_deleted")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (profile.is_deleted) {
    return NextResponse.json({ error: "already_deleted" }, { status: 409 });
  }

  let adminHandoverConfirmed = false;
  try {
    const body = await request.json();
    adminHandoverConfirmed = body?.adminHandoverConfirmed === true;
  } catch {
    // ボディなし／不正JSONは未確認として扱う
  }

  if (profile.is_admin && !adminHandoverConfirmed) {
    return NextResponse.json(
      { error: "admin_handover_confirmation_required" },
      { status: 400 }
    );
  }

  const { error: rpcError } = await admin.rpc("deactivate_user", {
    p_user_id: user.id,
  });

  if (rpcError) {
    return NextResponse.json({ error: "deactivation_failed" }, { status: 500 });
  }

  // 要件7.5: アカウントの退会。セッション破棄の前に、本人のIDで記録しておく
  await recordOperation(admin, {
    actionType: "account_delete",
    userId: user.id,
    targetId: user.id,
    detail: { wasAdmin: profile.is_admin },
  });

  // signOutでCookieが破棄される前に、有効なセッションのままIdP連携を解除する
  await unlinkAllIdentities(supabase);
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
