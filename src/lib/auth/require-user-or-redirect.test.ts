import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 出典: docs/tasks/browsing/post-detail-view/03-login-redirect-return-flow.md 単体テスト
 * - 未ログイン状態で投稿詳細画面のURLに直接アクセスした場合、ログイン画面へのリダイレクトURLに
 *   元のアクセス先が正しく含まれることを検証する
 * （ログイン完了後の復帰は /api/auth/callback が redirect_to を safeRedirectPath で検証して遷移する。
 *   F-AC-01 Task4 / F-AC-02 Task3 で実装済み）
 */
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

import { requireUserOrRedirect } from "./require-user-or-redirect";

const client = (user: { id: string } | null) =>
  ({ auth: { getUser: async () => ({ data: { user } }) } }) as unknown as SupabaseClient;

describe("requireUserOrRedirect", () => {
  it("未ログインなら元のアクセス先を redirect_to に含めてログイン画面へ送る", async () => {
    await expect(requireUserOrRedirect(client(null), "/posts/abc-123")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login?redirect_to=%2Fposts%2Fabc-123");
  });

  it("ログイン済みならユーザーを返し、リダイレクトしない", async () => {
    redirect.mockClear();
    await expect(requireUserOrRedirect(client({ id: "me" }), "/posts/abc-123")).resolves.toEqual({ id: "me" });
    expect(redirect).not.toHaveBeenCalled();
  });
});
