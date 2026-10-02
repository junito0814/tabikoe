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

  it("Bug #471: 戻るは back があればその画面名、無ければアルバム一覧。投稿へのリンクにはこのアルバムを back で渡す", () => {
    const withPost = { ...album("viewer"), posts: [{ id: "p1", spotId: "s1", spotName: "浅草寺", isManualSpot: false, category: "観光スポット", visitDate: null, duration: null, cost: null, rating: 4, commentExcerpt: null, latestComment: null, commentCount: 0, likeCount: 0, viewerHasLiked: false, viewerHasSaved: false, author: { id: "owner", displayName: "おーなー", avatarUrl: "/default-avatar.svg", isDeleted: false }, media: [], createdAt: "2026-09-01T00:00:00Z", latestStatus: null, walkMinutes: null, visibility: "public" as const, tripTitle: "夏の東北旅行" }] } as unknown as AlbumDetail;
    const { unmount } = render(<AlbumScreen album={withPost} initialInvitations={[]} viewerId="me" api={api()} back={{ href: "/notifications", label: "通知" }} />);
    expect(screen.getByRole("link", { name: "← 通知" })).toHaveAttribute("href", "/notifications");
    expect(document.querySelector("a[href^='/posts/p1']")).toHaveAttribute("href", "/posts/p1?back=%2Falbums%2Ftrip-1");
    unmount();
    render(<AlbumScreen album={album("viewer")} initialInvitations={[]} viewerId="me" api={api()} />);
    expect(screen.getByRole("link", { name: "← アルバム一覧" })).toHaveAttribute("href", "/albums");
  });

  it("SC-21: ヘッダーに「写真」リンクが出て、アルバム写真一覧へ行ける", () => {
    render(<AlbumScreen album={album("viewer")} initialInvitations={[]} viewerId="me" api={api()} />);
    expect(screen.getByRole("link", { name: /写真/ })).toHaveAttribute("href", "/albums/trip-1/photos");
  });

  it("v3.0: しおりのメンバーにだけ「しおりを見る」が出る", () => {
    const { unmount } = render(<AlbumScreen album={{ ...album("editor"), itineraryId: "it-1" }} initialInvitations={[]} viewerId="me" api={api()} />);
    expect(screen.getByRole("link", { name: /しおりを見る/ })).toHaveAttribute("href", "/itineraries/it-1?back=%2Falbums%2Ftrip-1");
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

/**
 * 出典: docs/tasks/shared-ui/loading-feedback/04-remaining-pending.md 単体テスト（4-8）
 * 要件定義書 4.5.11 の場面 3・8 章 89
 *
 * 【初心者向け】以前は招待リンクの発行だけに「発行中…」があり、名前変更・権限変更・
 * メンバー削除・退出は押せなくなるだけだった。`run(key, …)` が「どの操作か」を
 * もう持っているので、その key で押した 1 つだけ文言を変える。
 */
describe("4-8: アルバムの各操作の待ち表示", () => {
  /** 応答を返さない（＝押したあとの状態で止める） */
  const never = () => new Promise<Response>(() => {});

  it("名前の保存を押すと「保存しています…」になる", () => {
    render(<AlbumScreen album={album("owner")} initialInvitations={[]} viewerId="me" api={api({ rename: never })} />);
    // v3.1: 「名前を変更」ボタンは無く、タイトルをタップして変更する
    fireEvent.click(screen.getByRole("button", { name: "夏の東北旅行（名前を変更）" }));
    fireEvent.change(screen.getByLabelText("アルバム名"), { target: { value: "別の名前" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(screen.getByRole("button", { name: "保存しています…" })).toBeInTheDocument();
  });

  it("メンバー削除を押すと、その行だけ「削除中…」になる", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AlbumScreen album={album("owner")} initialInvitations={[]} viewerId="me" api={api({ removeMember: never })} />);
    fireEvent.click(screen.getByRole("button", { name: "わたしを削除" }));
    expect(screen.getByRole("button", { name: "わたしを削除" })).toHaveTextContent("削除中…");
  });

  it("権限を変えると「変更しています…」が隣に出る（select は文言を持てないため）", () => {
    render(<AlbumScreen album={album("owner")} initialInvitations={[]} viewerId="me" api={api({ changeRole: never })} />);
    fireEvent.change(screen.getByLabelText("わたしの権限"), { target: { value: "viewer" } });
    expect(screen.getByText("変更しています…")).toBeInTheDocument();
  });

  it("退出を押すと「退出しています…」になる", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AlbumScreen album={album("editor")} initialInvitations={[]} viewerId="me" api={api({ leave: never })} />);
    fireEvent.click(screen.getByRole("button", { name: "このアルバムから退出" }));
    expect(screen.getByRole("button", { name: "退出しています…" })).toBeInTheDocument();
  });

  it("招待リンクの無効化を押すと「無効化しています…」になる", () => {
    render(
      <AlbumScreen
        album={album("owner")}
        initialInvitations={[{ id: "inv-1", role: "viewer", status: "valid", expiresAt: "2026-10-09T00:00:00Z", createdAt: "2026-10-02T00:00:00Z", path: "/invitations/abc" }]}
        viewerId="me"
        api={api({ revokeInvitation: never })}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "無効化" }));
    expect(screen.getByRole("button", { name: "無効化しています…" })).toBeInTheDocument();
  });
});
