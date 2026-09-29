import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StepUpDialog } from "./StepUpDialog";

/** 出典: docs/tasks/admin/admin-login/07-step-up-reauth.md 単体テスト */
describe("StepUpDialog", () => {
  it("6 桁が通れば onDone(true)", async () => {
    const onDone = vi.fn();
    const verify = vi.fn(async () => Response.json({ ok: true }));
    render(<StepUpDialog onDone={onDone} verify={verify} />);
    fireEvent.change(screen.getByLabelText("認証アプリの 6 桁"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "確認して続ける" }));
    await waitFor(() => expect(verify).toHaveBeenCalledWith("123456"));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
  });

  it("やめるを押したら onDone(false)。API は呼ばない", () => {
    const onDone = vi.fn();
    const verify = vi.fn();
    render(<StepUpDialog onDone={onDone} verify={verify} />);
    fireEvent.click(screen.getByRole("button", { name: "やめる" }));
    expect(onDone).toHaveBeenCalledWith(false);
    expect(verify).not.toHaveBeenCalled();
  });

  it("番号が違うときは小窓にとどまり、入力欄を消さない", async () => {
    const onDone = vi.fn();
    const verify = vi.fn(async () => Response.json({ error: "invalid_code" }, { status: 400 }));
    render(<StepUpDialog onDone={onDone} verify={verify} />);
    const input = screen.getByLabelText("認証アプリの 6 桁");
    fireEvent.change(input, { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "確認して続ける" }));
    await waitFor(() => expect(screen.getByText("番号が合いません。認証アプリに出ている今の 6 桁を入れてください")).toBeInTheDocument());
    expect(input).toHaveValue("000000");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("6 桁になるまで押せない。Enter でも送れる", async () => {
    const verify = vi.fn(async () => Response.json({ ok: true }));
    render(<StepUpDialog onDone={vi.fn()} verify={verify} />);
    const button = screen.getByRole("button", { name: "確認して続ける" });
    expect(button).toBeDisabled();
    const input = screen.getByLabelText("認証アプリの 6 桁");
    fireEvent.change(input, { target: { value: "12345" } });
    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: "123456" } });
    expect(button).toBeEnabled();
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(verify).toHaveBeenCalledTimes(1));
  });
});
