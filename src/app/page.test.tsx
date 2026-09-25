import { describe, expect, it, vi } from "vitest";
import { render as renderDom, screen } from "@testing-library/react";

/**
 * 出典: docs/user-stories/account/signup-login.md（2026-09-25）／ 要件定義書 3.4.1「未ログイン時」
 * - 未ログインのホームは、画面遷移なしにログイン画面と同じ内容を出す（「はじめる」の 1 段を廃止）
 * - ログイン済みなら検索トップ
 */
const state = { user: null as { id: string; email: string | null } | null };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/auth/auth-user", () => ({ getAuthUserFromClaims: async () => state.user }));
vi.mock("@/components/search/SearchTopScreen", () => ({ SearchTopScreen: () => <div data-search-top /> }));
vi.mock("@/components/auth/AuthScreen", () => ({ default: ({ sky }: { sky?: boolean }) => <div data-auth-screen data-sky={String(Boolean(sky))} /> }));

import Home from "./page";

const render = async () => {
  const element = (await Home({ searchParams: Promise.resolve({}) })) as React.ReactElement;
  renderDom(element);
};

describe("SC-00 ホーム", () => {
  it("未ログインならログイン画面の内容を空のグラデーションつきで出す（「はじめる」は無い）", async () => {
    state.user = null;
    await render();
    expect(document.querySelector("[data-auth-screen]")).toHaveAttribute("data-sky", "true");
    expect(screen.queryByText("はじめる")).toBeNull();
  });

  it("ログイン済みなら検索トップを出す", async () => {
    state.user = { id: "u1", email: null };
    await render();
    expect(document.querySelector("[data-search-top]")).toBeInTheDocument();
    expect(document.querySelector("[data-auth-screen]")).toBeNull();
  });
});
