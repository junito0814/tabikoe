import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminMfaScreen } from "./AdminMfaScreen";

/** 出典: docs/tasks/admin/admin-login/05-mfa-screen.md 単体テスト（SC-32 の 2 つの顔） */
/**
 * #705（2026-10-05）: 6 桁が通ったあとの移動は `router.replace` ではなく
 * **画面ごと読み込み直す**（`hardRedirect`）。ルーターのキャッシュに
 * 「/admin は /admin/mfa へ飛ぶ」が 30 秒とどまっていて、戻されていた。
 */
const hardRedirect = vi.fn();
vi.mock("@/lib/navigation/hard-redirect", () => ({ hardRedirect: (href: string) => hardRedirect(href) }));

const enrollment = { factorId: "factor-1", qrImageSrc: "data:image/svg+xml;utf8,%3Csvg%3E", secret: "JBSW Y3DP EHPK 3PXP" };
const okResponse = async () => Response.json({ ok: true });

describe("AdminMfaScreen（登録）", () => {
  it("QR コードと手入力用の文字列を出し、6 桁を入れると登録して元の場所へ", async () => {
    const startEnroll = vi.fn(async () => Response.json(enrollment));
    const submitCode = vi.fn(okResponse);
    render(<AdminMfaScreen mode="enroll" redirectTo="/admin/reports" startEnroll={startEnroll} submitCode={submitCode} />);

    expect(screen.getByRole("heading", { name: "管理画面に入るには認証アプリの登録が必要です" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("JBSW Y3DP EHPK 3PXP")).toBeInTheDocument());
    expect(screen.getByAltText("認証アプリで読み取る QR コード")).toBeInTheDocument();

    const button = screen.getByRole("button", { name: "登録して管理画面へ" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("認証アプリの 6 桁"), { target: { value: "123456" } });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    // 登録の確認なので、enroll で作った factorId を一緒に送る
    await waitFor(() => expect(submitCode).toHaveBeenCalledWith({ code: "123456", factorId: "factor-1" }));
    await waitFor(() => expect(hardRedirect).toHaveBeenCalledWith("/admin/reports"));
  });

  it("登録は 1 回しか始めない（二重描画で factor を 2 つ作らない）", async () => {
    const startEnroll = vi.fn(async () => Response.json(enrollment));
    const { rerender } = render(<AdminMfaScreen mode="enroll" redirectTo="/admin" startEnroll={startEnroll} submitCode={okResponse} />);
    rerender(<AdminMfaScreen mode="enroll" redirectTo="/admin" startEnroll={startEnroll} submitCode={okResponse} />);
    await waitFor(() => expect(screen.getByText("JBSW Y3DP EHPK 3PXP")).toBeInTheDocument());
    expect(startEnroll).toHaveBeenCalledTimes(1);
  });

  it("QR コードが出せないときも、手入力用の文字列だけで進められる", async () => {
    const startEnroll = vi.fn(async () => Response.json({ ...enrollment, qrImageSrc: null }));
    render(<AdminMfaScreen mode="enroll" redirectTo="/admin" startEnroll={startEnroll} submitCode={okResponse} />);
    await waitFor(() => expect(screen.getByText("JBSW Y3DP EHPK 3PXP")).toBeInTheDocument());
    expect(screen.queryByAltText("認証アプリで読み取る QR コード")).not.toBeInTheDocument();
  });

  it("登録を始められなければ、その旨を出して 6 桁を送らせない", async () => {
    const startEnroll = vi.fn(async () => new Response(null, { status: 502 }));
    const submitCode = vi.fn(okResponse);
    render(<AdminMfaScreen mode="enroll" redirectTo="/admin" startEnroll={startEnroll} submitCode={submitCode} />);
    await waitFor(() => expect(screen.getByText("登録を始められませんでした。ページを再読み込みしてください")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("認証アプリの 6 桁"), { target: { value: "123456" } });
    expect(screen.getByRole("button", { name: "登録して管理画面へ" })).toBeDisabled();
    expect(submitCode).not.toHaveBeenCalled();
  });
});

describe("AdminMfaScreen（確認）", () => {
  it("QR コードは出さず、6 桁だけを聞く", async () => {
    const startEnroll = vi.fn();
    render(<AdminMfaScreen mode="verify" redirectTo="/admin/users" startEnroll={startEnroll} submitCode={okResponse} />);
    expect(screen.getByRole("heading", { name: "認証アプリの 6 桁を入れてください" })).toBeInTheDocument();
    expect(screen.queryByAltText("認証アプリで読み取る QR コード")).not.toBeInTheDocument();
    // 登録済みの人に手入力用の文字列を再表示しない
    expect(screen.queryByText("JBSW Y3DP EHPK 3PXP")).not.toBeInTheDocument();
    expect(startEnroll).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("認証アプリの 6 桁"), { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: "管理画面へ" }));
    await waitFor(() => expect(hardRedirect).toHaveBeenCalledWith("/admin/users"));
  });

  it("番号が合わないときは画面にとどまり、入力欄を消さずに入れ直せる", async () => {
    const submitCode = vi.fn(async () => Response.json({ error: "invalid_code" }, { status: 400 }));
    render(<AdminMfaScreen mode="verify" redirectTo="/admin" submitCode={submitCode} />);
    const input = screen.getByLabelText("認証アプリの 6 桁");
    fireEvent.change(input, { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "管理画面へ" }));

    await waitFor(() => expect(screen.getByText("番号が合いません。認証アプリに出ている今の 6 桁を入れてください")).toBeInTheDocument());
    expect(input).toHaveValue("000000");
    expect(screen.getByRole("button", { name: "管理画面へ" })).toBeEnabled();
  });

  it("6 桁になるまでは押せない", () => {
    render(<AdminMfaScreen mode="verify" redirectTo="/admin" submitCode={okResponse} />);
    const button = screen.getByRole("button", { name: "管理画面へ" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("認証アプリの 6 桁"), { target: { value: "12345" } });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("認証アプリの 6 桁"), { target: { value: "123456" } });
    expect(button).toBeEnabled();
  });

  it("Enter でも送れる", async () => {
    const submitCode = vi.fn(okResponse);
    render(<AdminMfaScreen mode="verify" redirectTo="/admin" submitCode={submitCode} />);
    const input = screen.getByLabelText("認証アプリの 6 桁");
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(submitCode).toHaveBeenCalledWith({ code: "123456", factorId: undefined }));
  });

  it("「認証アプリを解除する」導線は置かない（抜け道を作らない）", () => {
    render(<AdminMfaScreen mode="verify" redirectTo="/admin" submitCode={okResponse} />);
    expect(screen.queryByText(/解除/)).not.toBeInTheDocument();
    // メニューバーも管理用のメニューも出さない（要件 4.2）
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← サイトへ戻る" })).toHaveAttribute("href", "/");
  });
});
