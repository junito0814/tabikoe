import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isE2eEnabled } from "@/lib/e2e/enabled";
import { E2E_SEED_USERS, parseE2eLoginTarget } from "@/lib/e2e/seed-users";

/**
 * e2e-foundation Task 3: テスト専用のログイン経路（E2E のときだけ）
 * 出典: docs/tasks/shared-ui/e2e-foundation/03-test-login.md
 *
 * 【初心者向け】タビコエのログインは Google の画面を通るので、テストで自動化できません
 * （Google 側が自動操作を弾くし、他人の認証基盤を自動で叩くべきでもない）。
 * そこで**テストのときだけ通れる入口**を作りました。本番に出てはいけないものなので、守りを先に置いています。
 *
 * 守り
 *   1. `E2E_TEST` が `"1"` でなければ **404**（403 ではない。「あるが断られた」ことすら出さない）。判断は `isE2eEnabled` の 1 か所
 *   2. Vercel の上では、`E2E_TEST` がどうであれ 404（二重の守り。Vercel は自動で `VERCEL=1` を入れる）
 *   3. ログインできるのは種データの 2 名だけ。本文で受けるのは `"user"` / `"admin"` の印だけ
 *   4. 新しい利用者は作らない（種データに無ければ失敗する）
 *
 * 中でやっていること
 *   管理者の鍵で、その人用の「ログイン用の使い捨ての合言葉」（magic link のトークン）を作り、
 *   それをすぐにこのリクエストの中で使ってログインする。ログインした印（Cookie）は通常のログインと同じ形で返る。
 *   メールは送らない（generateLink は合言葉を返すだけ）。
 */
export async function POST(request: Request) {
  if (!isE2eEnabled(process.env.E2E_TEST) || process.env.VERCEL) {
    return new NextResponse(null, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const target = parseE2eLoginTarget(body);
  if (!target) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }
  const seedUser = E2E_SEED_USERS[target];

  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: seedUser.email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash || link.user?.id !== seedUser.id) {
    // 種データに無い（作り直しの前など）・別人に当たった、はどちらも失敗にする。新しい利用者は作らない
    return NextResponse.json({ error: "seed_user_not_found" }, { status: 500 });
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
  if (verifyError) {
    return NextResponse.json({ error: "login_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, as: target });
}
