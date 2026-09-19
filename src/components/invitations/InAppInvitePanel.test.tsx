import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { InAppInvitePanel, type InAppInviteApi } from "./InAppInvitePanel";

/**
 * 出典: docs/tasks/shared-ui/feedback-0919/06-in-app-invite.md 単体テスト
 * - 候補から相手を選んで送ると API が呼ばれ「送信済み」になること。未回答の相手は最初から「送信済み」
 * - 2 文字以上でユーザー名の検索が走ること
 */
const api = (overrides: Partial<InAppInviteApi> = {}): InAppInviteApi => ({
  fetchCandidates: vi.fn(async () => ({
    candidates: [
      { id: "ai", displayName: "あい", avatarUrl: "/a.png", pendingInvitationId: null },
      { id: "kenta", displayName: "けんた", avatarUrl: "/k.png", pendingInvitationId: "inv-1" },
    ],
  })),
  searchUsers: vi.fn(async () => ({ users: [{ id: "misaki", displayName: "みさき", avatarUrl: "/m.png" }] })),
  send: vi.fn(async () => Response.json({ invitation: { id: "inv-new" } }, { status: 201 })),
  ...overrides,
});

describe("InAppInvitePanel", () => {
  it("一緒だった人が並び、未回答の相手は「送信済み」。「招待を送る」で API が呼ばれ送信済みになる", async () => {
    const a = api();
    render(<InAppInvitePanel api={a} />);
    await waitFor(() => expect(screen.getByRole("list", { name: "一緒だった人" })).toBeInTheDocument());
    const kenta = document.querySelector("[data-invite-user='kenta']") as HTMLElement;
    expect(kenta).toHaveTextContent("送信済み");
    fireEvent.click(screen.getByRole("button", { name: "あいに招待を送る" }));
    await waitFor(() => expect(a.send).toHaveBeenCalledWith("ai"));
    await waitFor(() => expect(document.querySelector("[data-invite-user='ai']")).toHaveTextContent("送信済み"));
  });

  it("2 文字以上でユーザー名の検索が走り、結果から送れる", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const a = api();
    render(<InAppInvitePanel api={a} />);
    fireEvent.change(screen.getByLabelText("ユーザー名で探す"), { target: { value: "み" } });
    await vi.advanceTimersByTimeAsync(400);
    expect(a.searchUsers).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("ユーザー名で探す"), { target: { value: "みさ" } });
    await vi.advanceTimersByTimeAsync(400);
    expect(a.searchUsers).toHaveBeenCalledWith("みさ");
    await waitFor(() => expect(screen.getByRole("button", { name: "みさきに招待を送る" })).toBeInTheDocument());
    vi.useRealTimers();
  });
});
