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
  },
});
