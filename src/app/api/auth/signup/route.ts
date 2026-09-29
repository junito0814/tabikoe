import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasFullConsent } from "@/lib/auth/consent";
import { recordCurrentConsents } from "@/lib/legal/legal-documents";
import { resolvePostLoginRedirect } from "@/lib/auth/post-login-redirect";
import { ensureUserRecord } from "@/lib/users/ensure-user-record";
import { recordOperation } from "@/lib/logs/record-operation";
import { safeRedirectPath } from "@/lib/safe-redirect";

/**
 * signup-login Task11（2026-09-22）: 同意画面（SC-20）の「同意してはじめる」
 * 出典: docs/tasks/account/signup-login/11-google-once-signup.md
 *       要件定義書 v3.2 3.2.1「同意取得」
 *
 * POST /api/auth/signup  本体: { terms: true, privacy: true, redirectTo?: string }
 * 【初心者向け】Google の認証は済んでいる（Cookie にセッションがある）が、まだ users 行が無い人が呼ぶ。
 * 画面でボタンを押せなくするだけでは足りないので、ここでも両方の同意を確かめてからアカウントを作る。
 * 作ったら着地点（ホーム、または元の遷移先）を返し、画面側がそこへ移る。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  // ここだけは getUser()（Supabase Auth に問い合わせ）。ensureUserRecord が Google の識別子・表示名・アイコンを使うため
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { terms?: unknown; privacy?: unknown; redirectTo?: unknown };
  const consent = new URLSearchParams({ terms: body.terms === true ? "1" : "0", privacy: body.privacy === true ? "1" : "0" });
  const redirectTo = safeRedirectPath(typeof body.redirectTo === "string" ? body.redirectTo : null);

  const admin = createAdminClient();
  const { data: existing, error } = await admin.from("users").select("id, is_admin").eq("id", user.id).maybeSingle();
  if (error) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  // 登録済みなら作らず、そのまま着地点へ（同意日時は初回の値を保持）
  if (existing) {
    return NextResponse.json({ href: resolvePostLoginRedirect({ fromAdminLogin: false, isAdmin: existing.is_admin ?? false, redirectTo }) });
  }

  if (!hasFullConsent(consent)) {
    await recordOperation(admin, { actionType: "login_failure", detail: { reason: "consent_required" } });
    return NextResponse.json({ error: "consent_required" }, { status: 400 });
  }

  try {
    await ensureUserRecord(admin, user);
  } catch {
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
  // legal-documents Task 1（要件 3.10.11・7.4）: どの版に同意したかを残す
  await recordCurrentConsents(admin, user.id);
  // 要件 7.5: アカウントの登録と、その直後のログイン
  await recordOperation(admin, { actionType: "account_create", userId: user.id, targetId: user.id });
  await recordOperation(admin, { actionType: "login_success", userId: user.id, detail: { flow: "signup" } });

  return NextResponse.json({ href: redirectTo }, { status: 201 });
}
