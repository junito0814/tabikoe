import { describe, expect, it, vi } from "vitest";

/**
 * 出典: docs/deployment.md（環境変数の入れ忘れでビルドが丸ごと落ちた件、2026-09-25）
 *       #901（2026-10-17）で `src/app/layout.tsx` からここへ切り出した
 *
 * 【初心者向け】この部品は **404 ページを含む全ページ**で動きます。
 * ログイン状態の確認に失敗しても**例外にせず**、未ログインとして描かなければなりません
 * （ここで投げるとビルドごと止まる）。切り出したあとも同じであることを押さえます。
 */
const state = { fail: false };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (state.fail) throw new Error("Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL");
    return {};
  },
}));
vi.mock("@/lib/auth/auth-user", () => ({ getAuthUserFromClaims: async () => ({ id: "u1", email: null }) }));
vi.mock("@/components/layout/AppMenuBar", () => ({
  AppMenuBar: ({ isAuthenticated }: { isAuthenticated: boolean }) => <div data-menu={String(isAuthenticated)} />,
}));

import { getMenuBarUser, MenuBarSlot } from "./MenuBarSlot";

describe("MenuBarSlot（#901 で layout から切り出した）", () => {
  it("ログイン状態が読めないときも例外にせず、未ログインとして描く", async () => {
    state.fail = true;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const element = (await MenuBarSlot()) as React.ReactElement;
    expect(element).toBeTruthy();
    expect(JSON.stringify(element)).toContain("false");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("読めたときはログイン済みとしてメニューバーに渡す", async () => {
    state.fail = false;
    const element = (await MenuBarSlot()) as React.ReactElement;
    expect(JSON.stringify(element)).toContain("true");
  });

  it("読めないときは null を返す（投げない）", async () => {
    state.fail = true;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getMenuBarUser()).resolves.toBeNull();
    error.mockRestore();
  });
});
