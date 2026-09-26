import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { ItineraryDetailScreen } from "./ItineraryDetailScreen";
import type { ItineraryApi } from "./itinerary-api";
import type { ItineraryDetail, ItinerarySpotItem } from "@/lib/itineraries/get-itinerary";

/**
 * 出典: docs/tasks/itinerary/itinerary-basics/03-itinerary-detail-skeleton.md 単体テスト
 * - オーナーとメンバーでメニューが変わること、削除ダイアログの文言
 * 出典: docs/tasks/itinerary/itinerary-days/02-day-tabs-and-move-ui.md 単体テスト
 * - タブ数が日数＋1 になること、移動後もタブが変わらずトーストが出ること
 * 出典: docs/tasks/itinerary/arrival-time/03-spot-row-ui.md 単体テスト
 * - 時刻がある行で上下ボタンが無効になること、メモの保存が API を呼ぶこと
 * 出典: docs/tasks/itinerary/itinerary-check/03-row-display-and-map-pins.md 単体テスト
 * - チェックで取り消し線クラスが付き、順序が変わらないこと
 * 出典: docs/tasks/itinerary/itinerary-map-and-post/02-post-links.md 単体テスト
 * - 投稿済みの判定と表示、「投稿する」の href
 */
const spot = (spotId: string, overrides: Partial<ItinerarySpotItem> = {}): ItinerarySpotItem => ({
  id: `is-${spotId}`,
  spotId,
  name: `スポット${spotId}`,
  prefecture: "大阪府",
  lat: 34.7,
  lng: 135.5,
  isManualSpot: false,
  dayIndex: 1,
  arrivalTime: null,
  sortOrder: 0,
  memo: null,
  checkedAt: null,
  checkedBy: null,
  hasPosted: false,
  ratingAverage: 4,
  postCount: 3,
  ...overrides,
});

const detail = (overrides: Partial<ItineraryDetail> = {}): ItineraryDetail => ({
  id: "it-1",
  tripId: "trip-1",
  title: "大阪旅行",
  startDate: "2026-09-20",
  endDate: "2026-09-22",
  dayCount: 3,
  dayDates: ["2026-09-20", "2026-09-21", "2026-09-22"],
  role: "owner",
  spots: [spot("a", { arrivalTime: "10:00" }), spot("b", { sortOrder: 1 }), spot("c", { sortOrder: 2, hasPosted: true })],
  members: [{ userId: "me", displayName: "たろう", avatarUrl: "/a.png", role: "owner", joinedAt: "2026-09-01T00:00:00Z" }],
  albumPostCount: 2,
  updatedAt: "2026-09-01T00:00:00Z",
  ...overrides,
});

function makeApi(current: ItineraryDetail): ItineraryApi {
  return {
    list: vi.fn(),
    create: vi.fn(),
    get: vi.fn(async () => ({ itinerary: current })),
    updatePeriod: vi.fn(async () => Response.json({ ok: true })),
    rename: vi.fn(async () => Response.json({ ok: true })),
    remove: vi.fn(async () => Response.json({ ok: true })),
    addSpot: vi.fn(async () => Response.json({})),
    updateSpot: vi.fn(async () => Response.json({ ok: true })),
    removeSpot: vi.fn(async () => Response.json({ ok: true })),
    issueInvitation: vi.fn(),
    listInvitations: vi.fn(async () => ({ invitations: [] })),
    revokeInvitation: vi.fn(),
    fetchInviteCandidates: vi.fn(async () => ({ candidates: [] })),
    searchUsers: vi.fn(async () => ({ users: [] })),
    sendInvitation: vi.fn(),
    removeMember: vi.fn(),
    leave: vi.fn(),
  };
}

beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("ItineraryDetailScreen（SC-23）", () => {
  it("v3.1: タブは ALL（左端・初期選択）＋日数分。期間未設定なら ALL だけ。日付なしのスポットは ALL にだけ出る", () => {
    const withUndated = detail({ spots: [spot("a", { arrivalTime: "10:00" }), spot("u", { dayIndex: null })] });
    const { unmount } = render(<ItineraryDetailScreen initial={withUndated} viewerId="me" api={makeApi(withUndated)} />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent?.slice(0, 5))).toEqual(["ALL0/", "Day 1", "Day 2", "Day 3"]);
    expect(screen.getByRole("tab", { name: /ALL/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: /日付なし/ })).toBeNull();
    expect(document.querySelector("[data-itinerary-spot='u']")).toBeInTheDocument();
    // ALL では Day ごとの見出し
    expect(screen.getByRole("heading", { name: "Day 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "日付なし" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Day 1/ }));
    expect(document.querySelector("[data-itinerary-spot='u']")).toBeNull();
    unmount();
    render(<ItineraryDetailScreen initial={detail({ startDate: null, endDate: null, dayCount: 0, dayDates: [] })} viewerId="me" api={makeApi(detail())} />);
    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: /ALL/ })).toHaveAttribute("aria-selected", "true");
  });

  it("Bug #471: 戻るは back があればその画面名、無ければしおり一覧。スポット行の「投稿一覧」と「アルバムを見る」にはこのしおりを back で渡す", () => {
    const data = detail({ spots: [spot("a", { arrivalTime: "10:00" })], albumPostCount: 3 });
    const { unmount } = render(<ItineraryDetailScreen initial={data} viewerId="me" api={makeApi(data)} back={{ href: "/albums/trip-1", label: "アルバム" }} />);
    expect(screen.getByRole("link", { name: "アルバム" })).toHaveAttribute("href", "/albums/trip-1");
    expect(screen.getByRole("link", { name: "投稿一覧" })).toHaveAttribute("href", "/spots/a?back=%2Fitineraries%2Fit-1");
    expect(screen.getByRole("link", { name: /アルバム「.*」を見る/ })).toHaveAttribute("href", "/albums/trip-1?back=%2Fitineraries%2Fit-1");
    unmount();
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={makeApi(data)} />);
    expect(screen.getByRole("link", { name: "しおり一覧" })).toHaveAttribute("href", "/itineraries");
  });

  it("v3.1: 期間は年つきでタップで変更、タイトルは ✎ で名前変更、値段は出ない", () => {
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={makeApi(detail())} />);
    expect(screen.getByRole("button", { name: "期間 2026/9/20（日） 〜 2026/9/22（火）（変更）" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "期間を変更" })).toBeNull();
    expect(screen.getByRole("button", { name: "大阪旅行（名前を変更）" })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("予算目安");
    expect(document.body.textContent).not.toContain("¥");
  });

  it("v3.1: 時刻の無い行だけ取っ手 ≡ があり、↑↓ で並べ替えると sort_order を振り直す。上下ボタンは無い", async () => {
    const api = makeApi(detail());
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={api} />);
    const rowA = document.querySelector("[data-itinerary-spot='a']") as HTMLElement;
    expect(within(rowA).queryByRole("button", { name: /並べ替え/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "上へ" })).toBeNull();
    const rowB = document.querySelector("[data-itinerary-spot='b']") as HTMLElement;
    const handle = within(rowB).getByRole("button", { name: "スポットb を並べ替え" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    // b(1)・c(2) → c(0)・b(1)。変わった c だけ API を呼ぶ
    await waitFor(() => expect(api.updateSpot).toHaveBeenCalledWith("it-1", "c", { sortOrder: 0 }));
    expect(api.updateSpot).not.toHaveBeenCalledWith("it-1", "b", expect.anything());
    expect(within(rowB).getByRole("link", { name: "投稿する" })).toHaveAttribute("href", "/posts/new?itinerary=it-1&spot=b&day=1");
    const rowC = document.querySelector("[data-itinerary-spot='c']") as HTMLElement;
    expect(within(rowC).getByText("投稿済み ✓")).toBeInTheDocument();
    expect(within(rowC).queryByRole("link", { name: "投稿する" })).toBeNull();
  });

  it("チェックで取り消し線が付き、順序は変わらない。API に checked を送る", async () => {
    const api = makeApi(detail());
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={api} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "スポットb を行った場所にする" }));
    const rowB = document.querySelector("[data-itinerary-spot='b']") as HTMLElement;
    expect(rowB.querySelector("[data-spot-name]")).toHaveClass("line-through");
    await waitFor(() => expect(api.updateSpot).toHaveBeenCalledWith("it-1", "b", { checked: true }));
    const ids = Array.from(document.querySelectorAll("[data-itinerary-spot]")).map((el) => el.getAttribute("data-itinerary-spot"));
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("メモの保存が API を呼ぶ", async () => {
    const api = makeApi(detail());
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={api} />);
    const rowB = document.querySelector("[data-itinerary-spot='b']") as HTMLElement;
    fireEvent.click(within(rowB).getByRole("button", { name: "＋ メモを追加" }));
    fireEvent.change(within(rowB).getByRole("textbox", { name: "メモ" }), { target: { value: "昼前に行く" } });
    fireEvent.blur(within(rowB).getByRole("textbox", { name: "メモ" }));
    await waitFor(() => expect(api.updateSpot).toHaveBeenCalledWith("it-1", "b", { memo: "昼前に行く" }));
  });

  it("Day を移動しても画面は今の Day に留まり、トーストから移動先を開ける", async () => {
    const moved = detail({ spots: [spot("a", { arrivalTime: "10:00" }), spot("b", { sortOrder: 1, dayIndex: 2 }), spot("c", { sortOrder: 2 })] });
    const api = makeApi(moved);
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={api} initialDay={1} />);
    const rowB = document.querySelector("[data-itinerary-spot='b']") as HTMLElement;
    fireEvent.click(within(rowB).getByRole("button", { name: "Day を移動: Day 1" }));
    fireEvent.click(screen.getByRole("option", { name: "Day 2" }));
    await waitFor(() => expect(api.updateSpot).toHaveBeenCalledWith("it-1", "b", { dayIndex: 2 }));
    expect(screen.getByRole("tab", { name: /Day 1/ })).toHaveAttribute("aria-selected", "true");
    const toast = await screen.findByRole("status");
    expect(toast).toHaveTextContent("Day 2 に移動しました");
    await waitFor(() => expect(document.querySelector("[data-itinerary-spot='b']")).toBeNull());
    fireEvent.click(within(toast).getByRole("button", { name: "Day 2 を見る" }));
    expect(screen.getByRole("tab", { name: /Day 2/ })).toHaveAttribute("aria-selected", "true");
    expect(document.querySelector("[data-itinerary-spot='b']")).toBeInTheDocument();
  });

  it("オーナーには招待・名前変更・削除、メンバーにはメンバーだけ。削除の確認にアルバムが残る旨", async () => {
    const api = makeApi(detail());
    const { unmount } = render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={api} />);
    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    expect(screen.getByRole("menuitem", { name: "招待" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "名前を変更" })).toBeNull(); // v3.1: タイトルのタップで変更
    fireEvent.click(screen.getByRole("menuitem", { name: "しおりを削除" }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("アルバム（投稿）は残ります"));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("it-1"));
    unmount();

    render(<ItineraryDetailScreen initial={detail({ role: "member" })} viewerId="me" api={api} />);
    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    expect(screen.queryByRole("menuitem", { name: "招待" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "しおりを削除" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "メンバー" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /期間 .*（変更）/ })).toBeNull(); // メンバーは期間を変えられない
  });

  it("「＋ スポットを追加」は最多の都道府県で追加モードの投稿一覧へ（Day 1 を開いていれば day=1、ALL なら日付なし）", () => {
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={makeApi(detail())} initialDay={1} />);
    expect(screen.getByRole("link", { name: "＋ スポットを追加" })).toHaveAttribute("href", "/search?pref=%E5%A4%A7%E9%98%AA%E5%BA%9C&itinerary=it-1&day=1");
    fireEvent.click(screen.getByRole("tab", { name: /ALL/ }));
    expect(screen.getByRole("link", { name: "＋ スポットを追加" })).toHaveAttribute("href", "/search?pref=%E5%A4%A7%E9%98%AA%E5%BA%9C&itinerary=it-1");
  });

  it("v3.1: 「地図で見る」は別画面へ飛ばず上 1/3 に地図を出し、地図のタップで全画面（/map?itinerary=&day=）", () => {
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={makeApi(detail())} initialDay={1} />);
    expect(document.querySelector("[data-itinerary-static-map]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /地図で見る/ }));
    expect(document.querySelector("[data-map-sheet-layout]")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "地図を全画面に" })).toHaveAttribute("href", "/map?itinerary=it-1&day=1");
    fireEvent.click(screen.getByRole("button", { name: /地図を閉じる/ }));
    expect(document.querySelector("[data-itinerary-static-map]")).toBeNull();
  });
});
