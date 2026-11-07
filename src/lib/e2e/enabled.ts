/**
 * e2e-foundation Task 3: テスト専用のログイン経路を動かしてよいかの判断
 * 出典: docs/tasks/shared-ui/e2e-foundation/03-test-login.md
 *
 * 【初心者向け】`POST /api/e2e/login` は、パスワードも Google も通さずにログインできる入口です。
 * **本番に出たら、誰でも他人としてログインできてしまう**ので、判断をこの 1 か所に集め、
 * 単体テストで「`"1"` 以外はすべて無効」を固定しています（約束 13）。
 *
 * `E2E_TEST` は Vercel の Production・Preview のどちらにも設定しません（docs/deployment.md）。
 * 設定するのは E2E を動かすときだけ（playwright.config.ts がアプリに渡す）。
 *
 * `"true"` や `"yes"` を許さないのは、**うっかり有効になる道を減らす**ため。決まった 1 つの値だけを通します。
 */
export function isE2eEnabled(value: string | undefined): boolean {
  return value === "1";
}
