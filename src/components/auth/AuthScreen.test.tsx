import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AuthScreen from "./AuthScreen";

/**
 * 出典: docs/tasks/account/signup-login/03-login-screen-ui.md 単体テスト
 *       docs/tasks/account/signup-login/07-consent-flow.md 単体テスト
 *       要件定義書 受入条件42（同意欄はSC-20のみ）、7.7（キーボード操作）
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

describe("SC-01 ログイン画面（mode=login）", () => {
  it("同意欄（チェックボックス・利用規約）を表示しない", () => {
    render(<AuthScreen mode="login" />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText("利用規約")).not.toBeInTheDocument();
  });

  it("ログインボタンは最初から押せる", () => {
    render(<AuthScreen mode="login" />);
    expect(screen.getByRole("button", { name: /Googleでログイン/ })).toBeEnabled();
  });

  it("新規登録画面への導線がある", () => {
    render(<AuthScreen mode="login" />);
    expect(screen.getByRole("link", { name: "新規登録" })).toHaveAttribute("href", "/signup");
  });

  it("押下でgoogleを指定してsignInWithOAuthが呼ばれ、mode=loginがコールバックに乗る", async () => {
    render(<AuthScreen mode="login" />);
    fireEvent.click(screen.getByRole("button", { name: /Googleでログイン/ }));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1));
    const [args] = signInWithOAuth.mock.calls[0];
    expect(args.provider).toBe("google");
    const redirectTo = new URL(args.options.redirectTo);
    expect(redirectTo.pathname).toBe("/api/auth/callback");
    expect(redirectTo.searchParams.get("mode")).toBe("login");
    expect(redirectTo.searchParams.has("consent")).toBe(false);
  });

  it("URLのredirect_toがOAuthのコールバックURLに引き継がれる", async () => {
    searchParams = new URLSearchParams({ redirect_to: "/posts/new" });
    render(<AuthScreen mode="login" />);
    fireEvent.click(screen.getByRole("button", { name: /Googleでログイン/ }));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled());
    const redirectTo = new URL(signInWithOAuth.mock.calls[0][0].options.redirectTo);
    expect(redirectTo.searchParams.get("redirect_to")).toBe("/posts/new");
  });

  it("取得スコープをopenid/profile/emailに絞っている（F-AC-01 Task1）", async () => {
    render(<AuthScreen mode="login" />);
    fireEvent.click(screen.getByRole("button", { name: /Googleでログイン/ }));
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled());
    expect(signInWithOAuth.mock.calls[0][0].options.scopes).toBe("openid profile email");
  });

  it("未登録ユーザーがログインしようとした場合の案内を表示する", () => {
    searchParams = new URLSearchParams({ error: "account_not_found" });
    render(<AuthScreen mode="signup" />);
    expect(screen.getByText(/アカウントが見つかりません/)).toBeInTheDocument();
  });
});

describe("SC-20 アカウント新規作成画面（mode=signup）", () => {
  it("同意欄を表示する", () => {
    render(<AuthScreen mode="signup" />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.getByText("利用規約")).toBeInTheDocument();
    expect(screen.getByText("個人情報保護方針")).toBeInTheDocument();
  });

  it("未チェックでは作成ボタンが無効", () => {
    render(<AuthScreen mode="signup" />);
    expect(screen.getByRole("button", { name: /Googleでアカウントを作成/ })).toBeDisabled();
  });

  it("チェックすると作成ボタンが有効になる", () => {
    render(<AuthScreen mode="signup" />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: /Googleでアカウントを作成/ })).toBeEnabled();
  });

  it("同意チェックボックスは実体のあるinputで、キーボードから操作できる（要件7.7）", () => {
    render(<AuthScreen mode="signup" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox.tagName).toBe("INPUT");
    expect(checkbox).toHaveAttribute("type", "checkbox");
    // 隠しているだけでフォーカス可能（tabIndex=-1などで除外されていない）
    expect(checkbox).not.toHaveAttribute("tabindex", "-1");
  });

  it("同意済みで押下すると consent=1 と mode=signup がコールバックに乗る", async () => {
    render(<AuthScreen mode="signup" />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Googleでアカウントを作成/ }));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1));
    const redirectTo = new URL(signInWithOAuth.mock.calls[0][0].options.redirectTo);
    expect(redirectTo.searchParams.get("mode")).toBe("signup");
    expect(redirectTo.searchParams.get("consent")).toBe("1");
  });

  it("未チェックのままではsignInWithOAuthを呼ばない", async () => {
    render(<AuthScreen mode="signup" />);
    fireEvent.click(screen.getByRole("button", { name: /Googleでアカウントを作成/ }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });

  it("ログイン画面への導線がある", () => {
    render(<AuthScreen mode="signup" />);
    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute("href", "/login");
  });

  it("同意なしでコールバックから戻された場合の案内を表示する", () => {
    searchParams = new URLSearchParams({ error: "consent_required" });
    render(<AuthScreen mode="signup" />);
    expect(screen.getByText(/同意が必要です/)).toBeInTheDocument();
  });
});
