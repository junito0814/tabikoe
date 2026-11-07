import { test as base } from "@playwright/test";
import { resetAndSeed } from "./seed";
import { loginAs } from "./auth";
import { installGoogleBrowserStub, type GoogleBrowserStub } from "./maps-stub";
import type { E2eLoginTarget } from "../../src/lib/e2e/seed-users";

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
export const test = base.extend<{ freshDatabase: void; loginAs: (who: E2eLoginTarget) => Promise<void>; google: GoogleBrowserStub }>({
  freshDatabase: [
    // Playwright の決まった書き方。ほかの fixture を使わないときも、1 つ目の引数は分割代入（{}）で受ける
    async ({}, provide) => {
      await resetAndSeed();
      await provide();
    },
    { auto: true },
  ],
  /*
   * e2e-foundation Task 3: `await loginAs("user")` で種データの利用者としてログインする（auth.ts）。
   * DB の作り直しが先に済んでいる（上の freshDatabase は auto で先に走る）ので、ログインの相手は必ずいる。
   */
  /*
   * e2e-foundation Task 4: ブラウザから Google への通信を、毎回自動で差し替える（maps-stub.ts）。
   * 地図の読み込みはスタブで答え、それ以外は失敗させて `google.blocked` に記録する。
   */
  google: [
    async ({ context }, provide) => {
      await provide(await installGoogleBrowserStub(context));
    },
    { auto: true },
  ],
  // 2 つ目の引数（値をテストへ渡す関数）は、Playwright の例では `use` と書くが、React の `use` と見間違えて eslint が止めるので `provide` と呼ぶ
  loginAs: async ({ context }, provide) => {
    await provide((who) => loginAs(context, who));
  },
});

export { expect } from "@playwright/test";
