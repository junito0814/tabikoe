import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

/*
 * 2026-09-30（#632 の続き）: このファイルは待ちの多いテストが並んでいて、209 ファイルを
 * 並列で流すと既定の 5 秒を超えることがある。最初は落ちた 1 件だけ延ばしたが、**別のテストでも
 * 起きた**ので、1 件ずつ潰すのをやめてファイル全体に広げた。コードの不具合ではなく待ち時間の問題。
 * 他のファイルの上限は 5 秒のまま（全体を延ばすと、本当に固まったテストの発見が遅れる）。
 */
vi.setConfig({ testTimeout: 15000 });

import { ItineraryDetailScreen } from "./ItineraryDetailScreen";
import type { ItineraryApi } from "./itinerary-api";
import type { ItineraryDetail, ItinerarySpotItem } from "@/lib/itineraries/get-itinerary";
import { acceptConfirm, confirmSheetText } from "@/components/ui/confirm-sheet.testing";

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

// #778: 確認は window.confirm ではなくアプリ共通のシートになった。「⋯ → しおりから外す」のあと「外す」を押す
const removeSpotFromMenu = async (row: HTMLElement) => {
  openRowMenu(row);
  fireEvent.click(within(row).getByRole("menuitem", { name: "しおりから外す" }));
  await acceptConfirm();
};

/**
 * #753（2026-10-06）: 行の操作（投稿を見る・投稿する・しおりから外す）は右端の「⋯」の中へ移した。
 * そのため、中を見るテストは **まず「⋯」を開く**必要がある。
 */
const openRowMenu = (row: HTMLElement) => {
  fireEvent.click(within(row).getByRole("button", { name: /のその他$/ }));
  return row;
};

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
    // #753: 「投稿一覧」は「⋯」の中の「投稿を見る」になった（要件 4.5.15 の言葉の統一）
    openRowMenu(document.querySelector("[data-itinerary-spot='a']") as HTMLElement);
    expect(screen.getByRole("menuitem", { name: "投稿を見る" })).toHaveAttribute("href", "/spots/a?back=%2Fitineraries%2Fit-1");
    // #762: 「アルバム「〈タイトル〉」を見る」は見出しから外し、「⋯」の中の「アルバム」になった
    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    expect(screen.getByRole("menuitem", { name: "アルバム" })).toHaveAttribute("href", "/albums/trip-1?back=%2Fitineraries%2Fit-1");
    unmount();
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={makeApi(data)} />);
    expect(screen.getByRole("link", { name: "計画" })).toHaveAttribute("href", "/itineraries");
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
    // #753: 「投稿する」は「⋯」の中。投稿済みの行には出さず、代わりに段に「投稿済み ✓」の印
    openRowMenu(rowB);
    expect(within(rowB).getByRole("menuitem", { name: "投稿する" })).toHaveAttribute("href", "/posts/new?itinerary=it-1&spot=b&day=1");
    const rowC = document.querySelector("[data-itinerary-spot='c']") as HTMLElement;
    expect(within(rowC).getByText("投稿済み ✓")).toBeInTheDocument();
    openRowMenu(rowC);
    expect(within(rowC).queryByRole("menuitem", { name: "投稿する" })).toBeNull();
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

  /**
   * #685（2026-10-05）: メモの改行が表示に出ていなかった。
   *
   * 【初心者向け】HTML は既定で改行を 1 つの空白にまとめる。見張るのは
   * **文字そのもの**（改行入りの文が 1 つの要素に入っていること）と
   * **改行をそのまま見せる指定**（`whitespace-pre-wrap`）の 2 つ。
   * 指定が外れると、文字は同じまま表示だけ 1 行に潰れるため、両方見る。
   */
  it("メモの改行が表示に出る", () => {
    const withMemo = detail({ spots: [spot("a", { memo: "朝いち\n9 時に集合" }), spot("b", { sortOrder: 1 }), spot("c", { sortOrder: 2 })] });
    render(<ItineraryDetailScreen initial={withMemo} viewerId="me" api={makeApi(withMemo)} />);
    const rowA = document.querySelector("[data-itinerary-spot='a']") as HTMLElement;
    const memo = within(rowA).getByRole("button", { name: /メモ:/ });
    expect(memo).toHaveTextContent("メモ: 朝いち 9 時に集合");
    expect(memo.textContent).toContain("\n");
    expect(memo).toHaveClass("whitespace-pre-wrap");
  });

  it("長いメモでも枠から溢れない（折り返す指定がある）", () => {
    const withMemo = detail({ spots: [spot("a", { memo: "あ".repeat(80) }), spot("b", { sortOrder: 1 }), spot("c", { sortOrder: 2 })] });
    render(<ItineraryDetailScreen initial={withMemo} viewerId="me" api={makeApi(withMemo)} />);
    const rowA = document.querySelector("[data-itinerary-spot='a']") as HTMLElement;
    expect(within(rowA).getByRole("button", { name: /メモ:/ })).toHaveClass("break-words");
  });

  it("メモの入力欄は改行を打てる広さがある（3 行）", () => {
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={makeApi(detail())} />);
    const rowB = document.querySelector("[data-itinerary-spot='b']") as HTMLElement;
    fireEvent.click(within(rowB).getByRole("button", { name: "＋ メモを追加" }));
    expect(within(rowB).getByRole("textbox", { name: "メモ" })).toHaveAttribute("rows", "3");
  });

  it("Day を移動しても画面は今の Day に留まり、トーストから移動先を開ける", async () => {
    const moved = detail({ spots: [spot("a", { arrivalTime: "10:00" }), spot("b", { sortOrder: 1, dayIndex: 2 }), spot("c", { sortOrder: 2 })] });
    const api = makeApi(moved);
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={api} initialDay={1} />);
    const rowB = document.querySelector("[data-itinerary-spot='b']") as HTMLElement;
    // #812: 自前のリストをやめ、ブラウザ標準の <select> になった
    fireEvent.change(within(rowB).getByRole("combobox", { name: "Day を移動: Day 1" }), { target: { value: "2" } });
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
    // #778: 確認はアプリ共通のシート。アルバムが残る旨はその説明に出る
    await waitFor(() => expect(document.querySelector("[data-confirm-sheet]")).toBeInTheDocument());
    expect(confirmSheetText()).toContain("アルバム（投稿）は残ります");
    await acceptConfirm();
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

describe("loading-feedback Task 3: 押した直後に画面が変わる", () => {
  it("スポットを外している間は文言が出て、その行のボタンが押せなくなる", async () => {
    const current = detail();
    const api = makeApi(current);
    let resolveRemove: (response: Response) => void = () => {};
    api.removeSpot = vi.fn(() => new Promise<Response>((resolve) => { resolveRemove = resolve; }));
    render(<ItineraryDetailScreen initial={current} viewerId="me" api={api} />);

    const row = (document.querySelector("[data-spot-row='b']") ?? screen.getByText("スポットb").closest("li")!) as HTMLElement;
    await removeSpotFromMenu(row);

    // 押した直後に出る（API の結果を待たない）
    expect(await screen.findByRole("status")).toHaveTextContent("しおりから外しています…");
    // #753: 外している間は、その行の「⋯」が押せなくなる
    expect(within(row).getByRole("button", { name: /のその他$/ })).toBeDisabled();

    resolveRemove(Response.json({ ok: true }));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("再取得が終わるまで文言を出したままにする（2 往復目で無反応に戻らない）", async () => {
    const current = detail();
    const api = makeApi(current);
    let resolveGet: (data: { itinerary: ItineraryDetail }) => void = () => {};
    api.get = vi.fn(() => new Promise<{ itinerary: ItineraryDetail }>((resolve) => { resolveGet = resolve; }));
    render(<ItineraryDetailScreen initial={current} viewerId="me" api={api} />);

    const row = screen.getByText("スポットb").closest("li")! as HTMLElement;
    await removeSpotFromMenu(row);

    // 1 往復目（removeSpot）は終わったが、再取得はまだ
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByRole("status")).toHaveTextContent("しおりから外しています…");

    resolveGet({ itinerary: current });
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("失敗したら文言を消してエラーを出す", async () => {
    const current = detail();
    const api = makeApi(current);
    api.removeSpot = vi.fn(async () => Response.json({ error: "x" }, { status: 500 }));
    render(<ItineraryDetailScreen initial={current} viewerId="me" api={api} />);

    const rowB = screen.getByText("スポットb").closest("li")! as HTMLElement;
    await removeSpotFromMenu(rowB);
    await waitFor(() => expect(screen.getByText("外せませんでした")).toBeInTheDocument());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

/**
 * #694（2026-10-05）: しおり詳細の印を減らす（決定事項 74②③⑤）。
 * 押せば編集できるものに印を付けない、という考え方（プロフィールと同じ）。
 */
describe("印を減らす（#694）", () => {
  it("タイトルと期間に鉛筆の印を出さない（タップで変えられるのは今までどおり）", () => {
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={makeApi(detail())} />);
    expect(document.body.textContent).not.toContain("✎");
  });

  it("#757: 「地図で見る」は記号だけ（絵文字ではなく、読み上げ用の名前は持つ）", () => {
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={makeApi(detail())} />);
    const button = screen.getByRole("button", { name: "地図で見る" });
    expect(button.textContent?.trim()).toBe(""); // 文字は入っていない
    expect(button.querySelector("svg")).toBeInTheDocument();
  });

  it("期間に絵文字を出さない", () => {
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={makeApi(detail())} />);
    expect(document.body.textContent).not.toContain("📅");
  });

  it("#753: チェックの有無で「⋯」の中身は変わらない（チェックは「行った」の印で、投稿とは関係が無い）", () => {
    const withChecked = detail({ spots: [spot("a", { checkedAt: "2026-10-01T00:00:00.000Z" }), spot("b", { sortOrder: 1 })] });
    render(<ItineraryDetailScreen initial={withChecked} viewerId="me" api={makeApi(withChecked)} />);
    const labels = (id: string) => {
      const row = document.querySelector(`[data-itinerary-spot='${id}']`) as HTMLElement;
      openRowMenu(row);
      return within(row).getAllByRole("menuitem").map((item) => item.textContent?.trim());
    };
    expect(labels("a")).toEqual(["投稿を見る", "投稿する", "しおりから外す"]);
    expect(labels("b")).toEqual(["投稿を見る", "投稿する", "しおりから外す"]);
  });
});

/**
 * #753・#793（2026-10-06）: 行の形（案 F）
 * 出典: 要件定義書 3.11、ワイヤーフレーム決定事項 83 の前の相談
 */
describe("行の形（#753・#793）", () => {
  const openMenu = (row: HTMLElement) => fireEvent.click(within(row).getByRole("button", { name: /のその他$/ }));
  const row = (id: string) => document.querySelector(`[data-itinerary-spot='${id}']`) as HTMLElement;

  it("段に出るのは Day だけ（投稿一覧・投稿する・ゴミ箱は段から消える）", () => {
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={makeApi(detail())} />);
    const r = row("b");
    expect(within(r).queryByRole("link", { name: "投稿一覧" })).toBeNull();
    expect(within(r).queryByRole("link", { name: "投稿する" })).toBeNull();
    expect(within(r).queryByRole("button", { name: /をしおりから削除$/ })).toBeNull();
    expect(within(r).getByRole("combobox", { name: /^Day を(移動|決める)/ })).toBeInTheDocument();
  });

  it("赤いゴミ箱が行に出ていない（取り返しのつかない操作がいちばん目立つ形をやめた）", () => {
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={makeApi(detail())} />);
    expect(document.querySelector("[data-trash-button]")).toBeNull();
  });

  it("「⋯」の中は 投稿を見る／投稿する／しおりから外す", () => {
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={makeApi(detail())} />);
    const r = row("b");
    openMenu(r);
    expect(within(r).getAllByRole("menuitem").map((item) => item.textContent?.trim())).toEqual(["投稿を見る", "投稿する", "しおりから外す"]);
  });

  it("取っ手「≡」は左の列（時刻とチェックの下）にあり、時刻のある行には出ない", () => {
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={makeApi(detail())} />);
    expect(within(row("a")).queryByRole("button", { name: /並べ替え/ })).toBeNull();
    expect(within(row("b")).getByRole("button", { name: /並べ替え/ })).toBeInTheDocument();
  });

  it("★ が無い行でも場所を空けるので、「⋯」の位置が行ごとにずれない", () => {
    const data = detail({ spots: [spot("a", { ratingAverage: 4.5 }), spot("b", { sortOrder: 1, ratingAverage: null })] });
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={makeApi(data)} />);
    for (const id of ["a", "b"]) {
      const star = row(id).querySelector("[class*='text-star']")?.parentElement;
      expect(star, `${id} の★の場所`).not.toBeNull();
    }
    expect(row("b").querySelector("[class*='invisible']")).not.toBeNull();
  });

  it("#793: 「日付なし」の行には番号を付けない（順番がまだ無いため）", () => {
    const data = detail({ spots: [spot("a", { dayIndex: 1 }), spot("z", { dayIndex: null, sortOrder: 9 })] });
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={makeApi(data)} />);
    expect(within(row("a")).getByText("1")).toBeInTheDocument();
    expect(within(row("z")).queryByText("1")).toBeNull();
  });

  it("#793: 「日付なし」の行のボタンは「Day を決める」（その塊にいる時点で日付なしだと分かるため）", () => {
    const data = detail({ spots: [spot("z", { dayIndex: null })] });
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={makeApi(data)} />);
    expect(within(row("z")).getByRole("combobox", { name: "Day を決める" })).toHaveTextContent("Day を決める");
  });
});

/*
 * 本2-2（2026-10-06）: 見出しの作り直し
 * - #757: タイトルは独立した行（切れない）、「地図で見る」は記号
 * - #762: 「アルバム…を見る」は「⋯」の中の「アルバム」へ
 */
describe("見出しの作り直し（#757・#762）", () => {
  const longTitle = "#755 確認用 沖縄本島ぐるっと一周 5 泊 6 日";

  it("#757: タイトルは 1 行目から外れ、横幅いっぱいで 2 行まで出す（truncate をやめた）", () => {
    const data = detail({ title: longTitle });
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={makeApi(data)} />);
    const title = screen.getByRole("button", { name: `${longTitle}（名前を変更）` });
    expect(title).toHaveTextContent(longTitle);
    expect(title.className).toContain("line-clamp-2");
    expect(title.className).toContain("w-full");
    expect(title.className).not.toContain("truncate");
    // 1 行目（戻る・地図・⋯ の行）には入っていない
    expect(title.closest("[data-map-toggle]")).toBeNull();
    expect(screen.getByRole("link", { name: "計画" }).parentElement).not.toContainElement(title);
  });

  it("#757: オーナーでなければタイトルは見出し（h1）。押しても何も起きない", () => {
    const data = detail({ title: longTitle, role: "member" });
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={makeApi(data)} />);
    const title = screen.getByRole("heading", { level: 1, name: longTitle });
    expect(title.className).toContain("line-clamp-2");
    expect(screen.queryByRole("button", { name: `${longTitle}（名前を変更）` })).toBeNull();
  });

  it("#757: 地図の記号は開くと塗りつぶし、名前も「地図を閉じる」に変わる", () => {
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={makeApi(detail())} />);
    const toggle = screen.getByRole("button", { name: "地図で見る" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle.className).not.toContain("bg-accent");
    fireEvent.click(toggle);
    const opened = screen.getByRole("button", { name: "地図を閉じる" });
    expect(opened).toHaveAttribute("aria-pressed", "true");
    expect(opened.className).toContain("bg-accent");
  });

  it("#762: 「アルバム」は「⋯」の中のいちばん上（行き先なので操作より先）", () => {
    const data = detail({ albumPostCount: 3 });
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={makeApi(data)} />);
    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    const labels = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(labels).toEqual(["アルバム", "招待", "メンバー", "しおりを削除"]);
  });

  it("#762: 投稿が 0 件なら「アルバム」は出さない。見出しにもボタンを残さない", () => {
    const data = detail({ albumPostCount: 0 });
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={makeApi(data)} />);
    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    expect(screen.queryByRole("menuitem", { name: "アルバム" })).toBeNull();
    expect(document.body.textContent).not.toContain("を見る（");
  });
});

/*
 * 本2-3（2026-10-06）
 * - #779: 名前の変更が `window.prompt("アルバム名", …)` だった
 * - #789: 時刻ピッカーが外をタップしても閉じず、Day の一覧と重なっていた
 */
describe("名前の変更と重なり（#779・#789）", () => {
  it("#779: タイトルを押すとその場が入力欄。prompt は出ないし「アルバム名」とも書かない", async () => {
    const promptSpy = vi.spyOn(window, "prompt");
    const api = makeApi(detail());
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={api} />);
    fireEvent.click(screen.getByRole("button", { name: "大阪旅行（名前を変更）" }));
    expect(promptSpy).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("アルバム名");

    const input = screen.getByRole("textbox", { name: "しおりの名前" });
    expect(input).toHaveValue("大阪旅行");
    fireEvent.change(input, { target: { value: "京都 2 泊 3 日" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(api.rename).toHaveBeenCalledWith("it-1", "京都 2 泊 3 日"));
    promptSpy.mockRestore();
  });

  it("#779: 取消で元に戻る（API を呼ばない）", () => {
    const api = makeApi(detail());
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={api} />);
    fireEvent.click(screen.getByRole("button", { name: "大阪旅行（名前を変更）" }));
    fireEvent.change(screen.getByRole("textbox", { name: "しおりの名前" }), { target: { value: "書きかけ" } });
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.getByRole("button", { name: "大阪旅行（名前を変更）" })).toBeInTheDocument();
    expect(api.rename).not.toHaveBeenCalled();
  });

  it("#779: 空のまま保存しても何も起きない（元の名前のまま）", () => {
    const api = makeApi(detail());
    render(<ItineraryDetailScreen initial={detail()} viewerId="me" api={api} />);
    fireEvent.click(screen.getByRole("button", { name: "大阪旅行（名前を変更）" }));
    fireEvent.change(screen.getByRole("textbox", { name: "しおりの名前" }), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(api.rename).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "大阪旅行（名前を変更）" })).toBeInTheDocument();
  });

  it("#789: 時刻ピッカーを開いたまま外を触ると閉じる", () => {
    const data = detail({ spots: [spot("a")] });
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={makeApi(data)} />);
    fireEvent.click(screen.getByRole("button", { name: "到着予定時刻を設定" }));
    expect(document.querySelector("[data-time-picker]")).toBeInTheDocument();
    fireEvent.pointerDown(document.querySelector("[data-period]") as HTMLElement);
    expect(document.querySelector("[data-time-picker]")).toBeNull();
  });

  it("#789: 時刻ピッカーを開いたまま「Day ▾」を押すと、ピッカーが閉じて Day の一覧だけ開く", () => {
    const data = detail({ spots: [spot("a")] });
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={makeApi(data)} />);
    fireEvent.click(screen.getByRole("button", { name: "到着予定時刻を設定" }));
    // #812: Day は <select> になったので、触ると OS の選択画面が開く。
    // ここで確かめたいのは「時刻ピッカーが閉じること」
    const daySelect = screen.getByRole("combobox", { name: /Day を移動/ });
    // 実機のタップは pointerdown → click の順に起きる
    fireEvent.pointerDown(daySelect);
    fireEvent.click(daySelect);
    expect(document.querySelector("[data-time-picker]")).toBeNull();
  });

  it("#789: Esc で時刻ピッカーが閉じる", () => {
    const data = detail({ spots: [spot("a")] });
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={makeApi(data)} />);
    fireEvent.click(screen.getByRole("button", { name: "到着予定時刻を設定" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelector("[data-time-picker]")).toBeNull();
  });
});

describe("ALL の並び（#759）", () => {
  it("ALL では「日付なし」の塊が Day 1 より上に出る", () => {
    const data = detail({ spots: [spot("a", { dayIndex: 1 }), spot("z", { dayIndex: null, sortOrder: 9 })] });
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={makeApi(data)} />);
    const headings = [...document.querySelectorAll("[data-itinerary-detail] h2")].map((h) => h.textContent);
    expect(headings).toEqual(["日付なし", "Day 1"]);
    // 行そのものの順番も「日付なし」が先
    const rows = [...document.querySelectorAll("[data-itinerary-spot]")].map((row) => row.getAttribute("data-itinerary-spot"));
    expect(rows).toEqual(["z", "a"]);
  });

  it("Day 1 などの個別タブは今までどおり（その Day だけ）", () => {
    const data = detail({ spots: [spot("a", { dayIndex: 1 }), spot("z", { dayIndex: null, sortOrder: 9 })] });
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={makeApi(data)} initialDay={1} />);
    const rows = [...document.querySelectorAll("[data-itinerary-spot]")].map((row) => row.getAttribute("data-itinerary-spot"));
    expect(rows).toEqual(["a"]);
  });

  it("Day を移す選択肢の並びは変わらない（Day 1〜n → 日付なし）", () => {
    const data = detail({ spots: [spot("a", { dayIndex: 1 })] });
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={makeApi(data)} />);
    expect(
      within(screen.getByRole("combobox", { name: /Day を移動/ }))
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["Day 1", "Day 2", "Day 3", "日付なし"]);
  });
});
