import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AuthScreen from "./AuthScreen";

/**
 * 出典: docs/tasks/account/signup-login/03-login-screen-ui.md 単体テスト
 *       docs/tasks/account/signup-login/11-google-once-signup.md 単体テスト
 *       要件定義書 受入条件42（同意欄はSC-20のみ。SC-01 は「Google で続ける」1 つ）
 */
const signInWithOAuth = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOAuth } }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

// next/font/google はビルド時処理のため、テストでは差し替える
vi.mock("@/app/fonts", () => ({
  outfit: { className: "outfit" },
  lora: { className: "lora" },
}));

beforeEach(() => {
  signInWithOAuth.mockReset();
  signInWithOAuth.mockResolvedValue({ error: null });
  searchParams = new URLSearchParams();
});

describe("SC-01 ログイン画面", () => {
  it("同意欄（チェックボックス）を表示しない", () => {
    render(<AuthScreen />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText("利用規約")).toBeNull();
  });

  it("Task11: ボタンは「Google で続ける」1 つで最初から押せる。「新規登録」「アカウントを作成」の導線は無い", () => {
    render(<AuthScreen />);
    expect(screen.getByRole("button", { name: "Google で続ける" })).toBeEnabled();
    expect(screen.queryByRole("link", { name: "新規登録" })).toBeNull();
    expect(screen.queryByText(/アカウントをお持ちでない方/)).toBeNull();
    expect(screen.queryByText(/アカウントを作成/)).toBeNull();
  });

  it("押下でgoogleを指定してsignInWithOAuthが呼ばれ、コールバックに mode や consent は乗らない", async () => {
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Google で続ける" }));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1));
    const [args] = signInWithOAuth.mock.calls[0];
    expect(args.provider).toBe("google");
    const redirectTo = new URL(args.options.redirectTo);
    expect(redirectTo.pathname).toBe("/api/auth/callback");
    expect(redirectTo.searchParams.has("mode")).toBe(false);
    expect(redirectTo.searchParams.has("consent")).toBe(false);
  });

  it("URLのredirect_toがOAuthのコールバックURLに引き継がれる", async () => {
    searchParams = new URLSearchParams({ redirect_to: "/posts/new" });
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Google で続ける" }));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled());
    const redirectTo = new URL(signInWithOAuth.mock.calls[0][0].options.redirectTo);
    expect(redirectTo.searchParams.get("redirect_to")).toBe("/posts/new");
  });

  it("取得スコープをopenid/profile/emailに絞っている（F-AC-01 Task1）", async () => {
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Google で続ける" }));
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled());
    expect(signInWithOAuth.mock.calls[0][0].options.scopes).toBe("openid profile email");
  });

  it("管理者ログイン（?admin=1）は見出しが変わり、コールバックに admin=1 が乗る", async () => {
    searchParams = new URLSearchParams({ admin: "1" });
    render(<AuthScreen />);
    expect(screen.getByText("管理者ログイン")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Google で続ける" }));
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled());
    expect(new URL(signInWithOAuth.mock.calls[0][0].options.redirectTo).searchParams.get("admin")).toBe("1");
  });

  it("一時停止・30 日失効のエラーはそれぞれの文言を出す", () => {
    searchParams = new URLSearchParams({ error: "suspended" });
    const { unmount } = render(<AuthScreen />);
    expect(screen.getByText("このアカウントは一時停止されています")).toBeInTheDocument();
    unmount();
    searchParams = new URLSearchParams({ error: "expired" });
    render(<AuthScreen />);
    expect(screen.getByText("しばらく利用がなかったため、もう一度ログインしてください")).toBeInTheDocument();
  });

  it("Task12（2026-09-25）: sky を渡すと空のグラデーション、渡さなければ白地", () => {
    const { unmount, container } = render(<AuthScreen sky />);
    expect(container.firstElementChild).toHaveClass("bg-sky");
    unmount();
    const plain = render(<AuthScreen />);
    expect(plain.container.firstElementChild).toHaveClass("bg-app");
  });
});
