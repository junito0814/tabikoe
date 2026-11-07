import { test as base } from "@playwright/test";
import { resetAndSeed } from "./seed";

/**
 * e2e-foundation Task 2: **データベースを使う E2E は、この `test` を使う**
 * 出典: docs/tasks/shared-ui/e2e-foundation/02-local-supabase.md
 *
 * 【初心者向け】`@playwright/test` の `test` に「各テストの前に DB を作り直す」を足したものです。
 * `auto: true` なので、テストの中で何も書かなくても、毎回 種データだけが入った状態から始まります。
 * DB を使わないテスト（e2e/smoke.spec.ts など）は、作り直しの時間がもったいないので素の `test` を使います。
 *
 * テストどうしが同じ DB を取り合わないように、設定で 1 本ずつ順に動かしています（playwright.config.ts の workers）。
 */
export const test = base.extend<{ freshDatabase: void }>({
  freshDatabase: [
    // Playwright の決まった書き方。ほかの fixture を使わないときも、1 つ目の引数は分割代入（{}）で受ける
    async ({}, use) => {
      await resetAndSeed();
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
