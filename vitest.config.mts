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
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
