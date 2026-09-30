import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { formatTotpSecret, toQrImageSrc } from "@/lib/admin/mfa-qr";

/**
 * admin-login Task 5: POST /api/admin/mfa/enroll（認証アプリの登録を始める）
 * 出典: docs/tasks/admin/admin-login/05-mfa-screen.md
 *       要件定義書 3.10.1「認証アプリの登録」
 *
 * 返すもの: { factorId, qrImageSrc, secret }
 *
 * 【初心者向け】この API は「まだ確認していない factor」を 1 つ作り、その QR コードを返すだけ。
 * 登録が成立するのは、利用者が認証アプリの 6 桁を入れて /api/admin/mfa/verify を通ったとき。
 *
 * ここは `is_admin` だけを見て通す（`aal2` は求めない）。まだ二段階確認を通せない人が
 * 登録するための入口なので、`aal2` を求めると登録できず堂々巡りになる。
 */
export async function POST() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = await requireAdminUser(supabase, admin);
  // 管理者でなければ、この API の存在自体を見せない（要件 8 章 81）
  if (!user) return new NextResponse(null, { status: 404 });

  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError || !factors) {
    return NextResponse.json({ error: "list_factors_failed" }, { status: 502 });
  }

  // 既に確認済みの認証アプリがあるなら、登録し直させない（消せる導線を作らないため。Task 8 の復旧だけが道）
  if (factors.totp.length > 0) {
    return NextResponse.json({ error: "already_enrolled" }, { status: 409 });
  }

  // 途中でやめた登録（未確認の factor）が溜まるので、始める前に片付ける
  for (const stale of factors.all.filter((factor) => factor.status === "unverified")) {
    await supabase.auth.mfa.unenroll({ factorId: stale.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "タビコエ管理",
    issuer: "タビコエ",
  });
  if (error || !data) {
    return NextResponse.json({ error: "enroll_failed" }, { status: 502 });
  }

  // secret と QR コードは画面に出すために返す（手入力の道を残すため必要）。
  // ただしサーバーのログには絶対に出さない（AGENTS.md 21）
  return NextResponse.json({
    factorId: data.id,
    qrImageSrc: toQrImageSrc(data.totp.qr_code),
    secret: formatTotpSecret(data.totp.secret),
  });
}
