import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { UserListScreen, type FetchUsers } from "./UserListScreen";
import type { AdminUserRow } from "@/lib/admin/users";

/** 出典: docs/tasks/admin/user-management/01-user-list.md 単体テスト */
const rows: AdminUserRow[] = [
  { id: "u1", displayName: "はなこ", email: "h@example.com", createdAt: "2026-08-12T00:00:00Z", lastActiveAt: new Date().toISOString(), postCount: 23, reportedCount: 3, activeStrikes: 1, status: "normal", postingRestrictedUntil: null },
  { id: "u2", displayName: "じろう", email: "j@example.com", createdAt: "2026-09-02T00:00:00Z", lastActiveAt: null, postCount: 4, reportedCount: 2, activeStrikes: 2, status: "restricted", postingRestrictedUntil: "2026-09-28T00:00:00Z" },
  { id: "u3", displayName: "けんじ", email: "k@example.com", createdAt: "2026-07-30T00:00:00Z", lastActiveAt: null, postCount: 41, reportedCount: 6, activeStrikes: 5, status: "provisional", postingRestrictedUntil: null },
];
const query = { q: "", status: null, sort: "last_active" as const, offset: 0 };

describe("UserListScreen", () => {
  it("列（名前・メール・状態・ストライクの丸）が出て、行から詳細へ行ける", () => {
    render(<UserListScreen initialPage={{ users: rows, nextOffset: null }} initialQuery={query} />);
    const row = screen.getByText("じろう").closest("tr")!;
    expect(within(row).getByText("j@example.com")).toBeInTheDocument();
    expect(within(row).getByText("投稿禁止（〜9/28）")).toBeInTheDocument();
    expect(within(row).getByLabelText("有効なストライク 2/5")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "開く" })).toHaveAttribute("href", "/admin/users/u2");
    expect(within(screen.getByText("けんじ").closest("tr")!).getByText("仮停止（確認待ち）")).toBeInTheDocument();
  });

  it("検索と状態で「表示」すると 1 ページ目から取り直す", async () => {
    const fetchUsers = vi.fn<FetchUsers>(async () => ({ users: [rows[0]], nextOffset: null }));
    render(<UserListScreen initialPage={{ users: rows, nextOffset: null }} initialQuery={query} fetchUsers={fetchUsers} />);
    fireEvent.change(screen.getByLabelText("検索"), { target: { value: "はな" } });
    fireEvent.change(screen.getByLabelText("状態"), { target: { value: "suspended" } });
    fireEvent.click(screen.getByRole("button", { name: "表示" }));
    await waitFor(() => expect(fetchUsers).toHaveBeenCalledTimes(1));
    const params = fetchUsers.mock.calls[0][0];
    expect(params.get("q")).toBe("はな");
    expect(params.get("status")).toBe("suspended");
    expect(params.get("offset")).toBeNull();
  });
});
