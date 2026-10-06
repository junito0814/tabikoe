import { describe, expect, it, vi } from "vitest";

/**
 * 出典: docs/deployment.md（環境変数の入れ忘れでビルドが丸ごと落ちた件、2026-09-25）
 * - 共通レイアウトは全ページで動くので、ログイン状態の確認に失敗しても画面は描く（未ログイン扱い）
 */
const state = { fail: false };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (state.fail) throw new Error("Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL");
    return {};
  },
}));
vi.mock("@/lib/auth/auth-user", () => ({ getAuthUserFromClaims: async () => ({ id: "u1", email: null }) }));
vi.mock("@/components/layout/AppMenuBar", () => ({ AppMenuBar: ({ isAuthenticated }: { isAuthenticated: boolean }) => <div data-menu={String(isAuthenticated)} /> }));
// 2026-10-06: フォントはビルド時処理（.woff2 を読む）なので、テストでは差し替える
vi.mock("@/app/fonts", () => ({
  outfit: { className: "outfit", variable: "outfit" },
  lora: { className: "lora", variable: "lora" },
  geistSans: { className: "geist-sans", variable: "geist-sans" },
  geistMono: { className: "geist-mono", variable: "geist-mono" },
}));

import RootLayout from "./layout";

describe("RootLayout（共通レイアウト）", () => {
  it("ログイン状態が読めないときも例外にせず、未ログインとして描く", async () => {
    state.fail = true;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const element = (await RootLayout({ children: null, params: Promise.resolve({}) })) as React.ReactElement;
    expect(element).toBeTruthy();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("読めたときはログイン済みとしてメニューバーに渡す", async () => {
    state.fail = false;
    const element = (await RootLayout({ children: null, params: Promise.resolve({}) })) as React.ReactElement;
    expect(JSON.stringify(element)).toContain("isAuthenticated");
  });
});
