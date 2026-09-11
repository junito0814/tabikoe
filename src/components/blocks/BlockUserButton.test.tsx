import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BlockUserButton } from "./BlockUserButton";

/**
 * 出典: docs/tasks/safety/blocking/03-block-management-ui.md 単体テスト
 * - ブロック確認ダイアログの表示・キャンセル時に処理が実行されないことを検証する
 */
const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
});

describe("BlockUserButton", () => {
  it("初期状態では確認ダイアログを表示しない", () => {
    render(<BlockUserButton targetUserId="u1" targetDisplayName="たろう" submitBlock={vi.fn()} />);
    expect(screen.queryByText("たろう をブロックしますか")).not.toBeInTheDocument();
  });

  it("ブロック導線を押すと確認ダイアログが表示される", () => {
    render(<BlockUserButton targetUserId="u1" targetDisplayName="たろう" submitBlock={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "このユーザーをブロック" }));
    expect(screen.getByText("たろう をブロックしますか")).toBeInTheDocument();
  });

  it("キャンセルするとAPIは呼ばれず、ダイアログが閉じる", () => {
    const submitBlock = vi.fn();
    render(<BlockUserButton targetUserId="u1" targetDisplayName="たろう" submitBlock={submitBlock} />);

    fireEvent.click(screen.getByRole("button", { name: "このユーザーをブロック" }));
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(submitBlock).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByText("たろう をブロックしますか")).not.toBeInTheDocument();
  });

  it("「ブロックする」を押すと対象IDでAPIを呼び、トップページへ遷移する", async () => {
    const submitBlock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    render(<BlockUserButton targetUserId="u1" targetDisplayName="たろう" submitBlock={submitBlock} />);

    fireEvent.click(screen.getByRole("button", { name: "このユーザーをブロック" }));
    fireEvent.click(screen.getByRole("button", { name: "ブロックする" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/?blocked=1"));
    expect(submitBlock).toHaveBeenCalledWith("u1");
  });

  it("既にブロック済み（409）でも成功扱いで遷移する", async () => {
    const submitBlock = vi.fn().mockResolvedValue(new Response(null, { status: 409 }));
    render(<BlockUserButton targetUserId="u1" targetDisplayName="たろう" submitBlock={submitBlock} />);

    fireEvent.click(screen.getByRole("button", { name: "このユーザーをブロック" }));
    fireEvent.click(screen.getByRole("button", { name: "ブロックする" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/?blocked=1"));
  });

  it("失敗時はエラーを表示し、遷移しない", async () => {
    const submitBlock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    render(<BlockUserButton targetUserId="u1" targetDisplayName="たろう" submitBlock={submitBlock} />);

    fireEvent.click(screen.getByRole("button", { name: "このユーザーをブロック" }));
    fireEvent.click(screen.getByRole("button", { name: "ブロックする" }));

    await waitFor(() =>
      expect(screen.getByText("ブロックできませんでした。もう一度お試しください")).toBeInTheDocument()
    );
    expect(push).not.toHaveBeenCalled();
  });
});
