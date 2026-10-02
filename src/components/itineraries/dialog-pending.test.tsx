import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PeriodDialog } from "./PeriodDialog";
import { MembersDialog } from "./MembersDialog";
import { InviteDialog } from "./InviteDialog";
import type { ItineraryApi } from "./itinerary-api";
import type { ItineraryMember } from "@/lib/itineraries/get-itinerary";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

/**
 * 出典: docs/tasks/shared-ui/loading-feedback/04-remaining-pending.md 単体テスト（4-7）
 * 要件定義書 4.5.11 の場面 3・8 章 89
 *
 * 【初心者向け】3 つのダイアログはいずれも押すと `disabled` になるだけで文言が固定だった。
 * メンバーや招待は**行ごとにボタンが並ぶ**ので、「何かやっている」だけでは
 * どれが動いているのか分からない。押した 1 つだけ文言が変わることを確かめる。
 */
/** 応答を返さない（＝押したあとの状態で止める）ための約束 */
const never = () => new Promise<Response>(() => {});

describe("4-7: 期間を変更（PeriodDialog）", () => {
  it("保存を押すと「保存しています…」になる", () => {
    render(<PeriodDialog open startDate="2026-10-01" endDate="2026-10-03" onClose={vi.fn()} onSubmit={never} />);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(screen.getByRole("button", { name: "保存しています…" })).toBeInTheDocument();
  });
});

describe("4-7: メンバー（MembersDialog）", () => {
  const members: ItineraryMember[] = [
    { userId: "u1", displayName: "オーナー", avatarUrl: "/default-avatar.svg", role: "owner", joinedAt: "2026-09-01T00:00:00Z" },
    { userId: "u2", displayName: "たろう", avatarUrl: "/default-avatar.svg", role: "member", joinedAt: "2026-09-01T00:00:00Z" },
    { userId: "u3", displayName: "はなこ", avatarUrl: "/default-avatar.svg", role: "member", joinedAt: "2026-09-01T00:00:00Z" },
  ];
  const api = { removeMember: never, leave: never } as unknown as ItineraryApi;

  it("押した行だけ「削除中…」になる（他の行は「削除」のまま）", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<MembersDialog open itineraryId="it-1" members={members} viewerId="u1" role="owner" onClose={vi.fn()} api={api} />);
    // 「削除」は 2 人ぶん並ぶので、1 人目を押す
    fireEvent.click(screen.getAllByRole("button", { name: "削除" })[0]);
    expect(screen.getByRole("button", { name: "削除中…" })).toBeInTheDocument();
    // もう 1 人ぶんの「削除」は文言が変わっていない
    expect(screen.getByRole("button", { name: "削除" })).toBeInTheDocument();
  });

  it("退出を押すと「退出しています…」になる", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<MembersDialog open itineraryId="it-1" members={members} viewerId="u2" role="member" onClose={vi.fn()} api={api} />);
    fireEvent.click(screen.getByRole("button", { name: "このしおりから退出" }));
    expect(screen.getByRole("button", { name: "退出しています…" })).toBeInTheDocument();
  });
});

describe("4-7: 招待（InviteDialog）", () => {
  const api = {
    listInvitations: async () => ({ invitations: [{ id: "iv-1", path: "/invitations/t1", expiresAt: "2026-10-09T00:00:00Z", createdAt: "2026-10-02T00:00:00Z" }], pending: [] }),
    issueInvitation: never,
    revokeInvitation: never,
    fetchInviteCandidates: async () => ({ candidates: [] }),
    searchUsers: async () => ({ users: [] }),
    sendInvitation: never,
  } as unknown as ItineraryApi;

  it("発行を押すと「発行しています…」になる", async () => {
    render(<InviteDialog open itineraryId="it-1" onClose={vi.fn()} api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "招待リンクを発行" }));
    expect(screen.getByRole("button", { name: "発行しています…" })).toBeInTheDocument();
  });

  it("無効化を押すと「無効化しています…」になる", async () => {
    render(<InviteDialog open itineraryId="it-1" onClose={vi.fn()} api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "無効化" }));
    expect(screen.getByRole("button", { name: "無効化しています…" })).toBeInTheDocument();
  });
});
