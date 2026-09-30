import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { sessionCookieOptions } from "@/lib/supabase/cookie-options";
import { normalizeTotpCode } from "@/lib/admin/mfa-qr";
import { ADMIN_MFA_VERIFIED_COOKIE, mfaVerifiedCookieOptions } from "@/lib/admin/mfa-verified-cookie";

/**
 * admin-login Task 5: POST /api/admin/mfa/verify（6 桁を確かめて通す）
 * 出典: docs/tasks/admin/admin-login/05-mfa-screen.md
 *       要件定義書 3.10.1
 *
 * body: { code: string, factorId?: string }
 *
 * 【初心者向け】ここが二段階確認の心臓部。**6 桁の検証をサーバーで行うのが要点**。
 * ブラウザ側で verify して「通ったよ」とサーバーに伝える作りにすると、その申告を偽れるうえ、
 * `aal2` はセッションが切れるまで残るので「6 桁を入れずに期限だけ延ばす」ことができてしまう。
 * サーバーが自分で challenge → verify を通したときだけ Cookie の時刻を書き直す。
 *
 * この API も `is_admin` だけで通す（`aal2` は求めない）。ここを通ることで `aal2` になるため。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = await requireAdminUser(supabase, admin);
  if (!user) return new NextResponse(null, { status: 404 });

  let body: { code?: unknown; factorId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const code = normalizeTotpCode(body.code);
  if (!code) return NextResponse.json({ error: "invalid_code_format" }, { status: 400 });

  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError || !factors) {
    return NextResponse.json({ error: "list_factors_failed" }, { status: 502 });
  }

  // 使う factor を決める。画面から来た factorId は、この人が持っているものだけ受け付ける
  const requested = typeof body.factorId === "string" ? body.factorId : null;
  const factor = requested
    ? factors.all.find((item) => item.id === requested && item.factor_type === "totp")
    : factors.totp[0];
  if (!factor) return NextResponse.json({ error: "factor_not_found" }, { status: 409 });

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (challengeError || !challenge) {
    return NextResponse.json({ error: "challenge_failed" }, { status: 502 });
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) {
    // 番号が違う／時刻がずれている。何度も試されたときの制限は Supabase Auth 側に任せる（要件 7.3）
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  // ここまで来たら本当に 6 桁を通している。この時刻から 60 分（閲覧）・10 分（重い操作）を数える
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_MFA_VERIFIED_COOKIE, String(Date.now()), mfaVerifiedCookieOptions(sessionCookieOptions.secure));
  return response;
}
