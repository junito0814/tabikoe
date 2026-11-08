import type { BrowserContext } from "@playwright/test";
import type { E2eLoginTarget } from "../../src/lib/e2e/seed-users";

/**
 * e2e-foundation Task 3: テストの中で、種データの利用者としてログインする
 * 出典: docs/tasks/shared-ui/e2e-foundation/03-test-login.md
 *
 * 【初心者向け】テスト専用の入口（`POST /api/e2e/login`）を、ブラウザの「入れ物」（context）から叩きます。
 * context の request はブラウザと Cookie を共有しているので、ここでログインすれば、
 * そのあと `page.goto()` で開く画面はログインした状態になります。
 *
 * **各テストの最初に 1 回だけ**ログインします（fixtures/test.ts の `loginAs`）。
 * テストごとに DB を作り直す（fixtures/test.ts）と、ログインの記録も一緒に消えるので、
 * 前のテストのログイン状態（storageState）を次のテストへ持ち越すことはしません。
 * 1 回のログインは API を 1 本叩くだけで、画面を通らないので速く済みます。
 */
export async function loginAs(context: BrowserContext, who: E2eLoginTarget): Promise<void> {
  const response = await context.request.post("/api/e2e/login", { data: { as: who } });
  if (!response.ok()) {
    throw new Error(
      `テスト専用のログインに失敗しました（${response.status()}）。` +
        (response.status() === 404 ? "E2E_TEST=1 でアプリが動いているか確かめてください（playwright.config.ts）" : await response.text())
    );
  }
}
