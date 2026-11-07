import { defineConfig } from "@playwright/test";
import { readLocalSupabase } from "./e2e/fixtures/local-supabase";

/**
 * e2e-foundation Task 1: 受入テスト（E2E）の設定
 * 出典: docs/tasks/shared-ui/e2e-foundation/01-playwright.md
 *       要件定義書 9 章 未決定事項 No.12（2026-11-01 に決着）
 *
 * 【初心者向け】Playwright は「本物のブラウザを自動で動かして、画面を触ってみる」道具です。
 * 単体テスト（Vitest）が部品 1 つずつを確かめるのに対し、こちらは**画面をまたぐ動き**を確かめます。
 *
 * ここで決めていること
 *   1. **本番と同じビルド**（`next build` → `next start`）で動かす。開発サーバー（`next dev`）は
 *      初めて開く画面をその場で組み立てるので遅く、待ち時間がぶれてテストが不安定になる
 *   2. **ビルドは `.next-e2e/` に出す**（`NEXT_DIST_DIR`。next.config.ts）。手元で開発サーバーが
 *      動いていても、その `.next/` を書き換えない（約束 20: 開発サーバーの最中に build すると壊れる）
 *   3. **Supabase は手元の使い捨て（Docker の中）に向け、Google のキーはダミーにする。**
 *      手元の `.env.local` は本番の DB を向いているので、そのまま読ませると E2E が本番に繋がってしまう。
 *      Next.js は「既に入っている環境変数」を `.env.local` で上書きしないので、ここで渡した値が勝つ。
 *      ローカルの Supabase は `npm run test:e2e`（e2e/run.mjs）が起動する（Task 2）。
 *      動いていないとき（DB を使わない煙テストだけを直接動かすとき）は、CI と同じダミーを渡す
 *   4. ブラウザは **Chromium だけ**。WebKit は `--browser=webkit` で一度動かせることを確かめるだけ
 *      （ストーリーの「やらないこと」。3 種類で回すと CI の時間が 3 倍になる）
 *   5. 画面の大きさは実機と同じ **390 × 844**（約束 22）
 *   6. **1 本ずつ順に動かす**（workers: 1）。どのテストも同じ DB を作り直して使うので、
 *      同時に動かすと互いのデータを消し合う
 */
const PORT = 3100;

/** CI と同じダミー（.github/workflows/ci.yml）。本物の鍵は使わない。Supabase の 3 つは、ローカルが動いていれば上書きする */
const DUMMY_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "ci-dummy-publishable-key",
  SUPABASE_SECRET_KEY: "ci-dummy-secret-key",
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "ci-dummy-maps-key",
  GOOGLE_PLACES_API_KEY: "ci-dummy-places-key",
  GOOGLE_GEOCODING_API_KEY: "ci-dummy-geocoding-key",
};

/** ローカルの Supabase が動いていれば、その繋ぎ先（鍵は画面に出さない） */
const local = readLocalSupabase();
const SUPABASE_ENV = local
  ? { NEXT_PUBLIC_SUPABASE_URL: local.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.publishableKey, SUPABASE_SECRET_KEY: local.secretKey }
  : {};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  // CI では「1 回でも通れば緑」にしない。ゆらぎを再実行で隠さない（約束 23）
  retries: 0,
  // CI で test.only が残っていたら止める（1 本だけ走って「全部通った」に見えるのを防ぐ）
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 390, height: 844 },
    locale: "ja-JP",
    // 落ちたときだけ記録を残す（成功した分まで残すと重い）
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    // 手元で既に立ち上げてあれば、それを使う（CI では毎回作り直す）
    reuseExistingServer: !process.env.CI,
    // ビルドから始めるので長めに待つ
    timeout: 10 * 60 * 1000,
    env: { ...DUMMY_ENV, ...SUPABASE_ENV, NEXT_DIST_DIR: ".next-e2e", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
