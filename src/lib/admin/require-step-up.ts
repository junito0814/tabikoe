import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { needsStepUp } from "./mfa-gate";
import { ADMIN_MFA_VERIFIED_COOKIE, parseMfaVerifiedAt } from "./mfa-verified-cookie";

/**
 * admin-login Task 7: 重い操作の前の再確認（10 分）
 * 出典: docs/tasks/admin/admin-login/07-step-up-reauth.md
 *       要件定義書 3.10.1「重い操作の前の再確認」
 *
 * 【初心者向け】管理画面に入るときの二段階確認（60 分）とは別に、
 * **取り消せない操作の直前**にもう一度 6 桁を求める。GitHub の sudo mode と同じ考え方。
 * 閲覧は 60 分で守り、削除・停止・規約の公開のような戻せない操作だけをこの 10 分で守る。
 *
 * 関所ではなく**操作ごとの API の中**で確かめる。GET で読むだけの API には求めないため。
 *
 * 対象（要件 3.10.1）:
 *   - 投稿・コメントの削除（通報対応の `delete` のときだけ。`hide`・`no_issue` は元に戻せるので求めない）
 *   - 利用者の停止・解除・仮停止の確定と取り消し
 *   - ストライクの取り消し
 *   - 規約の公開
 */

/**
 * 直近 10 分以内に 6 桁を入れていなければ、返すべきレスポンスを返す。足りていれば null。
 *
 * 使い方（各 Route Handler の先頭、本人確認のすぐ後）:
 * ```ts
 * const stepUp = await requireStepUp();
 * if (stepUp) return stepUp;
 * ```
 */
export async function requireStepUp(): Promise<NextResponse | null> {
  const store = await cookies();
  const lastVerifiedAt = parseMfaVerifiedAt(store.get(ADMIN_MFA_VERIFIED_COOKIE)?.value);
  if (!needsStepUp({ lastVerifiedAt, now: Date.now() })) return null;
  return stepUpRequiredResponse();
}

/**
 * 409 で返す。401 にしない理由:
 * 401 だと「ログインが切れた」と区別できず、画面がログイン画面へ飛ばしてしまう。
 * ここで飛ばすと、管理者が書いた理由メモが消える（要件 3.10.1「画面ごと転送しない」）。
 */
export function stepUpRequiredResponse(): NextResponse {
  return NextResponse.json({ error: "step_up_required" }, { status: 409 });
}
