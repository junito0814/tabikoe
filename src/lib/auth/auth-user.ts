import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * performance Task1（2026-09-22）: 認証確認は手元の署名検証（getClaims）で行う
 * 出典: docs/tasks/shared-ui/performance/01-fewer-round-trips.md
 *       要件定義書 7.1「実装方針」
 *
 * 【初心者向け】`getUser()` は毎回 Supabase Auth のサーバーに「この人は誰？」と聞きに行く（1 回 30〜130ms）。
 * `getClaims()` は Cookie の JWT（署名付きの身分証）を、公開鍵で手元で検証するだけ（1ms）。公開鍵は最初の
 * 1 回だけ取りに行き、その後はプロセス内で共有される。1 画面で 3 回、API 1 本で 2 回呼ぶので、ここを変えると
 * 往復が大きく減る。前提はプロジェクトの署名鍵が非対称（ES256）であること（このプロジェクトは確認済み）。
 * 返す値は id と email だけ。Google の表示名など全部が要る所（新規登録）は `getUser()` を使う。
 */
export interface AuthUser {
  id: string;
  email: string | null;
}

/** claims（JWT の中身）から AuthUser を作る。sub（ユーザー ID）が無ければ null。純粋関数 */
export function authUserFromClaims(claims: { sub?: unknown; email?: unknown } | null | undefined): AuthUser | null {
  if (!claims || typeof claims.sub !== "string" || claims.sub.length === 0) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}

/** Cookie のセッションを手元で検証して AuthUser を返す。未ログイン・期限切れ・改ざんは null */
export async function getAuthUserFromClaims(supabase: SupabaseClient): Promise<AuthUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  return authUserFromClaims(data.claims);
}

/**
 * admin-login Task 6: JWT の `aal`（どれくらい強く本人確認したか）を読む。純粋関数
 * 出典: docs/tasks/admin/admin-login/06-proxy-aal2-gate.md
 *
 * 【初心者向け】`aal` は Supabase の JWT の必須項目なので、手元の署名検証だけで読める。
 * Google ログインだけなら `aal1`、認証アプリの 6 桁まで通ると `aal2`。
 * 入っていない・文字列でないときは null（呼び出し側は「aal2 ではない」として扱う）。
 */
export function aalFromClaims(claims: { aal?: unknown } | null | undefined): string | null {
  if (!claims || typeof claims.aal !== "string" || claims.aal.length === 0) return null;
  return claims.aal;
}
