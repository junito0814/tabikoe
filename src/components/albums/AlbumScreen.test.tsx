import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AlbumScreen, type AlbumApi } from "./AlbumScreen";
import type { AlbumDetail } from "@/lib/albums/get-album";

/**
 * 出典: docs/tasks/records/album/03-album-title-rename-integration.md 単体テスト
 * - role が owner でないメンバーには変更ボタンが表示されないことを検証する
 * 出典: docs/tasks/records/album-collaboration/00-index.md（管理UI）
 * - オーナーにだけ招待発行・権限変更・削除が出て、それ以外には退出が出る
 */
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const album = (viewerRole: AlbumDetail["viewerRole"]): AlbumDetail => ({
  tripId: "trip-1",
  title: "夏の東北旅行",
  ownerId: "owner",
  viewerRole,
  members: [
    { userId: "owner", role: "owner", displayName: "おーなー", avatarUrl: "/default-avatar.svg", isDeleted: false, joinedAt: "2026-09-01T00:00:00Z" },
    { userId: "me", role: viewerRole === "owner" ? "editor" : viewerRole, displayName: "わたし", avatarUrl: "/default-avatar.svg", isDeleted: false, joinedAt: "2026-09-02T00:00:00Z" },
  ],
  posts: [],
  itineraryId: null,
  isDaily: false,
});

const api = (overrides: Partial<AlbumApi> = {}): AlbumApi => ({
  rename: vi.fn(async () => Response.json({ trip: { id: "trip-1", title: "新しい名前" } })),
  issueInvitation: vi.fn(async () =>
    Response.json({ invitation: { id: "inv", role: "viewer", expiresAt: "2026-09-21T00:00:00Z", createdAt: "2026-09-14T00:00:00Z", path: "/invitations/abc" } }, { status: 201 })
  ),
  revokeInvitation: vi.fn(async () => Response.json({ revoked: true })),
  changeRole: vi.fn(async () => Response.json({})),
  removeMember: vi.fn(async () => Response.json({})),
  leave: vi.fn(async () => Response.json({})),
  ...overrides,
});

describe("AlbumScreen（SC-09）", () => {
  it("v3.1: 「日常」ではオーナーでも名前の変更と招待リンクが出ない", () => {
    render(<AlbumScreen album={{ ...album("owner"), title: "日常", isDaily: true }} initialInvitations={[]} viewerId="me" api={api()} />);
    expect(screen.queryByRole("button", { name: "名前を変更" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "招待リンク" })).toBeNull();
  });

  it("v3.0: しおりのメンバーにだけ「しおりを見る」が出る", () => {
    const { unmount } = render(<AlbumScreen album={{ ...album("editor"), itineraryId: "it-1" }} initialInvitations={[]} viewerId="me" api={api()} />);
    expect(screen.getByRole("link", { name: /しおりを見る/ })).toHaveAttribute("href", "/itineraries/it-1");
    unmount();
    render(<AlbumScreen album={album("editor")} initialInvitations={[]} viewerId="me" api={api()} />);
    expect(screen.queryByRole("link", { name: /しおりを見る/ })).toBeNull();
  });

  it("v3.1: 「名前を変更」ボタンは無く、しおりが無いアルバムはオーナーがタイトルをタップして変更。しおりがあればタイトルは押せない", () => {
    const { unmount } = render(<AlbumScreen album={album("owner")} initialInvitations={[]} viewerId="owner" api={api()} />);
    expect(screen.queryByRole("button", { name: "名前を変更" })).toBeNull();
    expect(screen.getByRole("button", { name: "夏の東北旅行（名前を変更）" })).toBeInTheDocument();
    unmount();
    render(<AlbumScreen album={{ ...album("owner"), itineraryId: "it-1" }} initialInvitations={[]} viewerId="owner" api={api()} />);
    expect(screen.queryByRole("button", { name: /名前を変更/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "夏の東北旅行" })).toBeInTheDocument();
  });

  it.each(["editor", "viewer"] as const)("%s には名称変更ボタンが出ない", (role) => {
    render(<AlbumScreen album={album(role)} initialInvitations={[]} viewerId="me" api={api()} />);
    expect(screen.queryByRole("button", { name: /名前を変更/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /リンクを発行/ })).toBeNull();
    expect(screen.getByRole("button", { name: "このアルバムから退出" })).toBeInTheDocument();
  });

  it("名称変更は PATCH /api/trips/[id] 相当を呼び、表示を更新する", async () => {
    const rename = vi.fn(async () => Response.json({ trip: { id: "trip-1", title: "新しい名前" } }));
    render(<AlbumScreen album={album("owner")} initialInvitations={[]} viewerId="owner" api={api({ rename })} />);
    fireEvent.click(screen.getByRole("button", { name: "夏の東北旅行（名前を変更）" }));
    fireEvent.change(screen.getByRole("textbox", { name: "アルバム名" }), { target: { value: "新しい名前" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(rename).toHaveBeenCalledWith("trip-1", "新しい名前"));
    // 変更後もタイトルはタップで変更できるボタンのまま（見出し要素ではない）
    expect(await screen.findByRole("button", { name: "新しい名前（名前を変更）" })).toBeInTheDocument();
  });

  it("オーナーは招待リンクを発行でき、URLが表示される", async () => {
    render(<AlbumScreen album={album("owner")} initialInvitations={[]} viewerId="owner" api={api()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "付与する権限" }), { target: { value: "editor" } });
    fireEvent.click(screen.getByRole("button", { name: /リンクを発行/ }));
    const url = await screen.findByText(/\/invitations\/abc$/);
    expect(url).toBeInTheDocument();
  });

  it("オーナーはメンバーの権限を変更でき、オーナー行には操作が出ない", async () => {
    const changeRole = vi.fn(async () => Response.json({}));
    render(<AlbumScreen album={album("owner")} initialInvitations={[]} viewerId="owner" api={api({ changeRole })} />);
    expect(screen.queryByRole("combobox", { name: "おーなーの権限" })).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "わたしの権限" }), { target: { value: "viewer" } });
    await waitFor(() => expect(changeRole).toHaveBeenCalledWith("trip-1", "me", "viewer"));
  });
});
