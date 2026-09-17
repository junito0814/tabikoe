import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }) }));

import { SpotPostListScreen, type SpotSummary } from "./SpotPostListScreen";
import { EMPTY_SEARCH_STATE } from "./post-search-query";
import type { PostCardData } from "@/lib/posts/post-cards";

/**
 * 出典: docs/tasks/map-search/post-timeline/04-spot-list-header-and-add-mode.md 単体テスト
 * - 見出し（スポット名・都道府県・件数・まだあった・地図で見る・＋・投稿する）
 * - 投稿が無ければ「まだ投稿がありません」
 * - バナーの表示条件と「完了」の遷移先
 */
const spot: SpotSummary = {
  id: "spot-1",
  name: "東京駅",
  prefecture: "東京都",
  lat: 35.68,
  lng: 139.76,
  isManualSpot: false,
  postCount: 7,
  isWishlisted: false,
  latestStatus: { status: "still_there", reportedAt: "2026-09-10T00:00:00Z" },
};

const card = (id: string): PostCardData => ({
  id,
  spotId: "spot-1",
  spotName: "東京駅",
  category: "グルメ",
  visitDate: "2026-09-01",
  duration: "1時間以内",
  cost: 1200,
  rating: 4,
  commentExcerpt: "良かった",
  createdAt: "2026-09-02T00:00:00Z",
  author: { id: "u1", displayName: "たろう", avatarUrl: "/default-avatar.svg" },
  thumbnailUrl: "https://example.com/p.jpg",
  thumbnailMediaType: "photo",
  mediaCount: 1,
  media: [],
  likeCount: 2,
  commentCount: 0,
  viewerHasLiked: false,
  viewerHasSaved: false,
  isManualSpot: false,
  prefecture: "東京都",
  spotLat: 35.68,
  spotLng: 139.76,
  walkMinutes: null,
  latestStatus: null,
});

describe("SpotPostListScreen（SC-04 スポット別）", () => {
  it("投稿が0件なら「まだ投稿がありません」", () => {
    render(<SpotPostListScreen spot={spot} initialState={EMPTY_SEARCH_STATE} initialPage={{ posts: [], nextOffset: null }} fetchPage={vi.fn()} />);
    expect(screen.getByText("まだ投稿がありません")).toBeInTheDocument();
  });

  it("見出しにスポット名・都道府県・件数・まだあった・地図で見る・＋・投稿する", () => {
    render(<SpotPostListScreen spot={spot} initialState={EMPTY_SEARCH_STATE} initialPage={{ posts: [card("p1")], nextOffset: null }} fetchPage={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("東京駅");
    expect(screen.getByText("東京都")).toBeInTheDocument();
    expect(screen.getByText("投稿 7 件")).toBeInTheDocument();
    expect(screen.getByText("9月にまだあった")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "地図で見る" })[0]).toHaveAttribute(
      "href",
      "/map?spot=spot-1&lat=35.68&lng=139.76&back=%2Fsearch%3Fspot%3Dspot-1"
    );
    expect(screen.getAllByRole("button", { name: "保存する" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "投稿する" })).toHaveAttribute("href", "/posts/new?spot=spot-1");
    // 見出しにスポット名があるので、カードの見出しは出さない
    expect(document.querySelector("[data-post-card='p1'] h3")).toBeNull();
    expect(screen.getByRole("link", { name: "地図" })).toHaveAttribute("href", "/map");
  });

  it("追加モードならバナーが出て「完了」でしおりへ戻る", () => {
    render(
      <SpotPostListScreen
        spot={spot}
        initialState={EMPTY_SEARCH_STATE}
        initialPage={{ posts: [], nextOffset: null }}
        addMode={{ itineraryId: "it-1", day: null, title: "東京旅行", spotIds: [] }}
        fetchPage={vi.fn()}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent("東京旅行");
    expect(screen.getByRole("status")).toHaveTextContent("未定 に追加中");
    expect(screen.getByRole("link", { name: "完了" })).toHaveAttribute("href", "/itineraries/it-1");
  });
});
