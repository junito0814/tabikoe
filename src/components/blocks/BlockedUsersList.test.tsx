import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BlockedUsersList, type BlockedUser } from "./BlockedUsersList";

/**
 * 出典: docs/tasks/safety/blocking/03-block-management-ui.md 単体テスト
 * - ブロック解除で一覧から対象が消えること
 */
const users: BlockedUser[] = [
  { id: "a", displayName: "たろう", avatarUrl: null },
  { id: "b", displayName: "はなこ", avatarUrl: null },
];

describe("BlockedUsersList", () => {
  it("ブロック中のユーザーがいなければ空メッセージを表示する", () => {
    render(<BlockedUsersList initialBlockedUsers={[]} submitUnblock={vi.fn()} />);
    expect(screen.getByText("ブロック中のユーザーはいません")).toBeInTheDocument();
  });

  it("初期一覧を表示する", () => {
    render(<BlockedUsersList initialBlockedUsers={users} submitUnblock={vi.fn()} />);
    expect(screen.getByText("たろう")).toBeInTheDocument();
    expect(screen.getByText("はなこ")).toBeInTheDocument();
  });

  it("解除するとAPIを呼び、対象だけが一覧から消える", async () => {
    const submitUnblock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    render(<BlockedUsersList initialBlockedUsers={users} submitUnblock={submitUnblock} />);

    fireEvent.click(screen.getAllByRole("button", { name: "解除" })[0]);

    await waitFor(() => expect(screen.queryByText("たろう")).not.toBeInTheDocument());
    expect(submitUnblock).toHaveBeenCalledWith("a");
    expect(screen.getByText("はなこ")).toBeInTheDocument();
  });

  it("既に解除済み（404）でも一覧から消す", async () => {
    const submitUnblock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    render(<BlockedUsersList initialBlockedUsers={users} submitUnblock={submitUnblock} />);

    fireEvent.click(screen.getAllByRole("button", { name: "解除" })[0]);

    await waitFor(() => expect(screen.queryByText("たろう")).not.toBeInTheDocument());
  });

  it("失敗時はエラーを表示し、一覧は変えない", async () => {
    const submitUnblock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    render(<BlockedUsersList initialBlockedUsers={users} submitUnblock={submitUnblock} />);

    fireEvent.click(screen.getAllByRole("button", { name: "解除" })[0]);

    await waitFor(() =>
      expect(screen.getByText("ブロックを解除できませんでした")).toBeInTheDocument()
    );
    expect(screen.getByText("たろう")).toBeInTheDocument();
  });
});
