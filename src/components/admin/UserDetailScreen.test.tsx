import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UserDetailScreen } from "./UserDetailScreen";
import type { AdminUserDetail } from "@/lib/admin/user-detail";

/** 出典: docs/tasks/admin/user-management/02-user-detail-actions.md 単体テスト */
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const base: AdminUserDetail = {
  id: "u1",
  displayName: "じろう",
  email: "jiro@example.com",
  createdAt: "2026-09-02T00:00:00Z",
  lastActiveAt: null,
  status: "restricted",
  suspendedAt: null,
  postingRestrictedUntil: "2099-09-28T00:00:00Z",
  counts: { posts: 4, comments: 11, reported: 2 },
  strikes: [
    { id: "s1", createdAt: "2026-09-25T00:00:00Z", expiresAt: "2026-12-24T00:00:00Z", revokedAt: null, reasonLabel: "不適切な表現", actionLabel: "非公開化", targetLabel: "感想「…」", state: "active" },
    { id: "s2", createdAt: "2026-06-02T00:00:00Z", expiresAt: "2026-08-31T00:00:00Z", revokedAt: null, reasonLabel: "不適切な表現", actionLabel: "非公開化", targetLabel: null, state: "expired" },
  ],
  activeStrikeCount: 1,
  strikesToSuspend: 5,
  nextMeasure: "3日間 投稿・コメント禁止",
  posts: [],
  comments: [],
  reportsAgainst: [],
  actionsOn: [],
};

describe("UserDetailScreen", () => {
  it("理由が空だと停止できない（確認ダイアログが開かない）", () => {
    const submit = vi.fn();
    render(<UserDetailScreen user={base} submitAction={submit} />);
    fireEvent.click(screen.getByRole("button", { name: "アカウントを停止する" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("理由を入力してください")).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it("理由を入れて停止 → 確認 → 実行で API を呼ぶ（既定で公開投稿の一括非公開がオン）", async () => {
    const submit = vi.fn(async () => new Response(JSON.stringify({ ok: true, hiddenPosts: 4 }), { status: 200 }));
    render(<UserDetailScreen user={base} submitAction={submit} />);
    fireEvent.change(screen.getByLabelText("理由（メモ・必須）"), { target: { value: "規約違反" } });
    fireEvent.click(screen.getByRole("button", { name: "アカウントを停止する" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "実行する" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith("suspend", "u1", { note: "規約違反", hidePosts: true }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("アカウントの停止を記録しました"));
  });

  it("停止中は「停止を解除する」が押せ、通常時は無効", () => {
    const { rerender } = render(<UserDetailScreen user={base} />);
    expect(screen.getByRole("button", { name: "停止を解除する" })).toBeDisabled();
    rerender(<UserDetailScreen user={{ ...base, status: "provisional", suspendedAt: "2026-09-26T00:00:00Z" }} />);
    expect(screen.getByRole("button", { name: "停止を解除する" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "仮停止を確定する" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "アカウントを停止する" })).not.toBeInTheDocument();
  });

  it("有効なストライクだけ取り消せ、理由つきで API を呼ぶ。失効分には取り消しが無い", async () => {
    const submit = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<UserDetailScreen user={base} submitAction={submit} />);
    expect(screen.getAllByRole("button", { name: "取り消す" })).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("取り消しの理由（9/25）"), { target: { value: "誤判定" } });
    fireEvent.click(screen.getByRole("button", { name: "取り消す" }));
    fireEvent.click(screen.getByRole("button", { name: "実行する" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith("revoke", "s1", { note: "誤判定" }));
  });

  it("いまの制限と次の措置が出る", () => {
    render(<UserDetailScreen user={base} />);
    expect(screen.getByText(/投稿・コメント 禁止（9\/28まで）/)).toBeInTheDocument();
    expect(screen.getByText("次のストライクで 3日間 投稿・コメント禁止")).toBeInTheDocument();
  });
});
