import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SignupConsentScreen, type SignupConsentApi } from "./SignupConsentScreen";

/**
 * 出典: docs/tasks/account/signup-login/11-google-once-signup.md 単体テスト
 * - メールアドレスの表示、片方だけでは無効、両方で有効、押すと API が呼ばれ href へ遷移、「やめる」で cancel が呼ばれ SC-01 へ
 * - 同意チェックボックスは実体のある input（要件 7.7）
 */
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/fonts", () => ({ outfit: { className: "outfit" }, lora: { className: "lora" } }));

const api = (overrides: Partial<SignupConsentApi> = {}): SignupConsentApi => ({
  signup: vi.fn(async () => Response.json({ href: "/" }, { status: 201 })),
  cancel: vi.fn(async () => Response.json({ ok: true })),
  ...overrides,
});

beforeEach(() => replace.mockClear());

describe("SignupConsentScreen（SC-20 同意画面）", () => {
  it("Google のアカウント（メール）を表示し、Google のボタンは無い", () => {
    render(<SignupConsentScreen email="yamada@example.com" api={api()} />);
    expect(screen.getByText("yamada@example.com")).toBeInTheDocument();
    expect(screen.getByText("として登録します")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Google/ })).toBeNull();
  });

  it("片方だけのチェックでは無効、両方で有効。チェックは実体のある input", () => {
    render(<SignupConsentScreen email="a@b" api={api()} />);
    const button = screen.getByRole("button", { name: "同意してはじめる" });
    expect(button).toBeDisabled();
    const terms = screen.getByRole("checkbox", { name: "利用規約に同意する" });
    expect(terms.tagName).toBe("INPUT");
    fireEvent.click(terms);
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "個人情報保護方針に同意する" }));
    expect(button).toBeEnabled();
  });

  it("両方に同意して押すと signup API が terms/privacy/redirectTo で呼ばれ、返った href へ移る", async () => {
    const a = api({ signup: vi.fn(async () => Response.json({ href: "/posts/new" }, { status: 201 })) });
    render(<SignupConsentScreen email="a@b" redirectTo="/posts/new" api={a} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "利用規約に同意する" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "個人情報保護方針に同意する" }));
    fireEvent.click(screen.getByRole("button", { name: "同意してはじめる" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/posts/new"));
    expect(a.signup).toHaveBeenCalledWith({ terms: true, privacy: true, redirectTo: "/posts/new" });
  });

  it("API が 400 を返したら同意が必要という案内を出し、遷移しない", async () => {
    render(<SignupConsentScreen email="a@b" api={api({ signup: vi.fn(async () => Response.json({ error: "consent_required" }, { status: 400 })) })} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "利用規約に同意する" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "個人情報保護方針に同意する" }));
    fireEvent.click(screen.getByRole("button", { name: "同意してはじめる" }));
    await waitFor(() => expect(screen.getByText(/両方への同意が必要/)).toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
  });

  it("「やめる」で cancel API が呼ばれ、ログイン画面へ戻る", async () => {
    const a = api();
    render(<SignupConsentScreen email="a@b" api={a} />);
    fireEvent.click(screen.getByRole("button", { name: "やめる" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(a.cancel).toHaveBeenCalledTimes(1);
  });
});
