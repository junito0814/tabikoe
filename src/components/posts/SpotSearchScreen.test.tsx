import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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
  it("スポットカードに スポット名・タビコエだけの場所・★の平均・投稿件数・感想・まだあった が出て、リンク先はスポット別一覧", () => {
    render(<SpotSearchScreen context={pref} initialState={EMPTY_SEARCH_STATE} initialPage={{ spots: [spot("s1"), spot("s2")], nextOffset: null }} title="東京都" backHref="/" backLabel="ホーム" />);
    expect(document.querySelectorAll("[data-spot-card]")).toHaveLength(2);
    const card = document.querySelector("[data-spot-card='s2']") as HTMLElement;
    expect(card).toHaveTextContent("スポット s2");
    expect(card).toHaveTextContent("タビコエだけの場所");
    expect(card).toHaveTextContent("4.5");
    expect(card).toHaveTextContent("投稿 3 件");
    expect(card).toHaveTextContent("朝イチが空いてる");
    expect(card).toHaveTextContent("9月にまだあった");
    expect(card.querySelector("a")).toHaveAttribute("href", "/search?spot=s2");
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
