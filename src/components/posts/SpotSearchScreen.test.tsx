import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }) }));

import { SpotSearchScreen } from "./SpotSearchScreen";
import { EMPTY_SEARCH_STATE, parseSearchState, type SearchContext } from "./post-search-query";
import type { SpotCardData } from "@/lib/spots/search-spots";

/**
 * 出典: docs/tasks/shared-ui/mentoring-7/03-spot-cards.md 単体テスト
 * - 検索結果がスポット単位のカードで、タップするとスポット別の投稿一覧が開くこと（受入条件45）
 * - 並び替えの選択肢が 新着順／評価順／投稿数順 で、選ぶと sort=count 付きで取り直すこと
 */
const pref: SearchContext = { destination: { kind: "prefecture", name: "東京都" } };

const spot = (id: string, overrides: Partial<SpotCardData> = {}): SpotCardData => ({
  id,
  name: `スポット ${id}`,
  lat: 35.7,
  lng: 139.7,
  prefecture: "東京都",
  isManualSpot: id === "s2",
  postCount: 3,
  averageRating: 4.5,
  coverUrl: "https://example.com/c.jpg",
  coverMediaType: "photo",
  latestComment: "朝イチが空いてる",
  latestPostAt: "2026-09-10T00:00:00Z",
  latestStatus: { status: "still_there", reportedAt: "2026-09-12T00:00:00Z" },
  walkMinutes: null,
  viewerHasSaved: false,
  ...overrides,
});

beforeEach(() => {
  replace.mockClear();
});

describe("SpotSearchScreen（SC-04 検索結果・スポット単位）", () => {
  it("スポットカードに スポット名・★の平均・投稿件数・感想・まだあった が出て、リンク先はスポット別一覧", () => {
    render(<SpotSearchScreen context={pref} initialState={EMPTY_SEARCH_STATE} initialPage={{ spots: [spot("s1"), spot("s2")], nextOffset: null }} title="東京都" backHref="/" backLabel="ホーム" />);
    expect(document.querySelectorAll("[data-spot-card]")).toHaveLength(2);
    const card = document.querySelector("[data-spot-card='s2']") as HTMLElement;
    expect(card).toHaveTextContent("スポット s2");
    // #680（2026-10-05）: ラベルは廃止（決定事項 70）
    expect(card).not.toHaveTextContent("タビコエだけの場所");
    expect(card).toHaveTextContent("4.5");
    expect(card).toHaveTextContent("投稿 3 件");
    expect(card).toHaveTextContent("朝イチが空いてる");
    expect(card).toHaveTextContent("9月にまだあった");
    // Bug #469: 今の検索結果の URL を back= で渡す（スポット別一覧の戻るが「← 東京都」になる）
    const href = new URL(card.querySelector("a")?.getAttribute("href") ?? "", "https://example.com");
    expect(href.pathname + "?" + href.searchParams.get("spot")).toBe("/search?s2");
    expect(decodeURIComponent(href.searchParams.get("back") ?? "")).toBe("/search?pref=東京都");
  });

  it("並び替えは 新着順／評価順／投稿数順 で、投稿数順を選ぶと sort=count で取り直し URL も変わる", async () => {
    const fetchPage = vi.fn<(params: URLSearchParams) => Promise<{ spots: SpotCardData[]; nextOffset: number | null }>>(async () => ({ spots: [spot("s9")], nextOffset: null }));
    render(<SpotSearchScreen context={pref} initialState={EMPTY_SEARCH_STATE} initialPage={{ spots: [spot("s1")], nextOffset: null }} title="東京都" backHref="/" backLabel="ホーム" fetchPage={fetchPage} />);
    fireEvent.click(screen.getByRole("button", { name: "並び替え: 新着順" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["新着順", "評価順", "投稿数順"]);
    fireEvent.click(screen.getByRole("option", { name: "投稿数順" }));
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
    expect(fetchPage.mock.calls[0]?.[0].get("sort")).toBe("count");
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("sort=count"), { scroll: false });
    await waitFor(() => expect(document.querySelector("[data-spot-card='s9']")).toBeInTheDocument());
  });

  it("URL の sort=count は検索結果の文脈で読める（スポット別では新着順に倒れる）", () => {
    const params = new URLSearchParams("sort=count");
    expect(parseSearchState(params, pref).sort).toBe("count");
    expect(parseSearchState(params, { destination: { kind: "spot", spotId: "s1" } }).sort).toBe("newest");
  });

  it("0 件のときは案内文", () => {
    render(<SpotSearchScreen context={pref} initialState={EMPTY_SEARCH_STATE} initialPage={{ spots: [], nextOffset: null }} title="東京都" backHref="/" backLabel="ホーム" />);
    expect(screen.getByText("条件に合う投稿がありません")).toBeInTheDocument();
  });
});

/*
 * #673（2026-10-03）: 検索結果に「引っ張って更新」が無かった
 * 出典: 要件定義書 4.5.11 の場面 6・受入条件 96
 *
 * 【初心者向け】2026-10-02 に 6 画面へ付けたとき、**包む画面を間違えて**
 * スポット別の一覧（PostSearchScreen）の方に付けていた。実機で「検索結果で引いても
 * 何も起きない」と分かって見つかった。指で引く動きそのものは PullToRefresh.test.tsx で
 * 確かめているので、ここでは**この画面が包まれていること**だけを見る。
 */
describe("#673: 引っ張って更新", () => {
  it("検索結果は PullToRefresh で包まれている", () => {
    render(<SpotSearchScreen context={pref} initialState={EMPTY_SEARCH_STATE} initialPage={{ spots: [spot("s1")], nextOffset: null }} title="東京都" backHref="/" backLabel="ホーム" />);
    const container = document.querySelector("[data-pull-to-refresh]");
    expect(container, "検索結果は「付ける」6 画面の 1 つ（受入条件 96）").not.toBeNull();
    // 中身ごと包んでいること（一部だけ包むと、引ける場所が画面の一部に限られる）
    expect(container?.querySelector("[data-spot-card='s1']")).not.toBeNull();
  });
});

/**
 * #681（2026-10-05）: 検索結果に「地図」タブ（決定事項 71）。
 * スポット別の投稿一覧には出さない（そのスポットは決まっているため）。
 */
describe("地図タブ（#681）", () => {
  it("検索結果では 投稿／写真／地図 の 3 つが選べる", () => {
    render(<SpotSearchScreen context={pref} initialState={EMPTY_SEARCH_STATE} initialPage={{ spots: [spot("s1")], nextOffset: null }} title="東京都" backHref="/" backLabel="ホーム" />);
    const toggle = screen.getByRole("radiogroup", { name: "表示" });
    expect(within(toggle).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["投稿", "写真", "地図"]);
  });
});
