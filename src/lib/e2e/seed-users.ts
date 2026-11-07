/**
 * e2e-foundation Task 3: E2E の種データの利用者（2 名）
 * 出典: docs/tasks/shared-ui/e2e-foundation/03-test-login.md・02-local-supabase.md
 *
 * 【初心者向け】テスト専用のログイン経路（`POST /api/e2e/login`）は、**ここにある 2 名にしか**ログインさせません。
 * 本文で受け取るのは `"user"` か `"admin"` という**印だけ**で、メールアドレスや ID は受け取りません。
 * 任意の相手を指せないようにして、万一この入口が開いていても被害を種データの 2 名に閉じ込めます。
 *
 * 種データを入れる側（e2e/fixtures/seed.ts）もこの定義を読みます。ID とメールアドレスを 2 か所に書かないため（約束 14）。
 * メールアドレスの `.invalid` は、実在しないことが決まっているドメイン（RFC 2606）。間違って送っても誰にも届きません。
 */
export const E2E_SEED_USERS = {
  user: { id: "00000000-0000-4000-8000-0000000000e1", email: "taro@e2e.invalid", displayName: "たろう", isAdmin: false },
  admin: { id: "00000000-0000-4000-8000-0000000000e2", email: "admin@e2e.invalid", displayName: "管理者", isAdmin: true },
} as const;

export type E2eLoginTarget = keyof typeof E2E_SEED_USERS;

/**
 * 本文からログインする相手の印を取り出す。`{ "as": "user" }` か `{ "as": "admin" }` だけを受け付け、
 * それ以外（メールアドレス・ID・ほかの印・余計な形）はすべて null（呼び出し側が断る）。
 */
export function parseE2eLoginTarget(body: unknown): E2eLoginTarget | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const value = (body as Record<string, unknown>).as;
  return value === "user" || value === "admin" ? value : null;
}
