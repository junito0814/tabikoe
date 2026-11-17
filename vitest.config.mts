import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * 単体テストの設定（docs/rule.md「test rule」のうち unit test に対応）。
 * 構成は Next.js 同梱ドキュメント（node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md）に準拠。
 * ガイドは vite-tsconfig-paths を使うが、現行の Vite は tsconfig の paths を
 * 標準で解決できる（resolve.tsconfigPaths）ため、プラグインは使わない。
 *
 * 結合テスト（Supabaseを実際に叩くもの）・E2E（Playwright）は本設定の対象外。
 * 前者はローカルSupabase、後者はブラウザ環境が別途必要になる。
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      /*
       * #929（2026-10-17）: `import "server-only"` を含むファイルを、テストから辿れるようにする。
       *
       * 【初心者向け】`server-only` は「このファイルをブラウザ側に混ぜたらビルドで止める」という印で、
       * パッケージの実体は Next.js が内部に持っている（`next/dist/compiled/server-only`）。
       * 単体テスト（Vite）は Next.js を通さないので、そのままでは見つけられず読み込みに失敗する。
       * 印そのものはビルド時の話なので、テストでは**何もしない空のファイル**に差し替える。
       * 本番のビルドはこの設定を見ないので、印は今までどおり効く。
       */
      "server-only": "next/dist/compiled/server-only/empty.js",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // e2e-foundation Task 1: E2E（Playwright。e2e/）は単体テストで拾わない。include だけでも拾わないが、明記して固定する
    exclude: ["e2e/**", "node_modules/**"],
    /*
     * #1078（2026-11-17）: 1 本のテストの時間切れを 5 秒（既定）→ 10 秒にする。
     *
     * 【初心者向け】手元で Docker（E2E 用のローカル Supabase）を動かしたまま単体テストを流すと、
     * ときどき 1〜5 件が「5 秒を超えた」で落ちていた。測ると次のとおりで、**テストの中には原因が無い**。
     *   - 落ちたテストは、ふだん 0.6〜1 秒で終わる（Docker を止めて同じテストを測った値）
     *   - 落ちるテストが毎回違う（2026-11-13 は 2 件、2026-11-17 は別の 5 件）。どれもファイルの途中で、最初の 1 本ではない
     *   - 同じ条件でも、全件通る回がある。落ちたのは、ほかの重い作業が同時に動いていたとき
     *   - この機械は CPU 8 個・メモリ 8GB。テスト中の負荷は CPU の約 3 倍、空きメモリは 3 割弱
     * つまり「機械が混んでいる瞬間に、たまたま重なったテストが数秒待たされる」だけなので、上限に余裕を持たせる。
     * ふだん 1 秒以内に終わるテストが 10 秒かかることは無いので、本当に止まっているテストは今までどおり落ちる。
     */
    testTimeout: 10_000,
  },
});
