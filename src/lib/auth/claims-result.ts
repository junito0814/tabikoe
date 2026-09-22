/**
 * performance Task1: テストで `supabase.auth.getClaims()` の戻り値を作る小さな道具（本番コードからは使わない）。
 * 【初心者向け】getClaims は { data: { claims }, error } の形で返す。ログイン中なら claims に sub（ユーザー ID）と email、
 * 未ログインならエラー。テストではこの形を毎回書くのが面倒なので、ここで作る。
 */
export function claimsResultOf(user: { id: string; email?: string | null } | null | undefined) {
  if (!user) return { data: null, error: new Error("no session") };
  return { data: { claims: { sub: user.id, email: user.email ?? undefined } }, error: null };
}
