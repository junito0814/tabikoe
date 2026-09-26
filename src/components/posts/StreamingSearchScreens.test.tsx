import { describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { StreamingSpotPostListScreen, StreamingSpotSearchScreen } from "./StreamingSearchScreens";
import { EMPTY_SEARCH_STATE } from "./post-search-query";
import type { SpotSummary } from "./SpotPostListScreen";
import type { SearchFirstPage } from "@/lib/search/load-search-page";
import { CardListSkeleton } from "@/components/skeleton/Skeletons";

/**
 * 出典: docs/tasks/shared-ui/performance/02-streaming.md 単体テスト
 * - 1 ページ目の Promise が届くまで骨組み（Suspense の fallback）が出て、届いたら本来の画面になる
 */
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/search" }));
vi.mock("@/components/map/StaticSpotMap", () => ({ StaticSpotMap: () => <div data-static-spot-map /> }));

const spot: SpotSummary = { id: "spot-1", name: "東京駅", prefecture: "東京都", lat: 35.68, lng: 139.76, isManualSpot: false, postCount: 0, ratingAverage: null, isWishlisted: false, latestStatus: null };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("StreamingSearchScreens（1 ページ目のストリーミング）", () => {
  it("スポット別: 届くまで骨組み、届いたら投稿一覧", async () => {
    const first = deferred<SearchFirstPage>();
    // React 19 の use() を jsdom で待つには、描画と解決の両方を act で包む
    await act(async () => {
      render(
        <Suspense fallback={<CardListSkeleton />}>
          <StreamingSpotPostListScreen spot={spot} initialState={EMPTY_SEARCH_STATE} fetchPage={vi.fn()} firstPage={first.promise} />
        </Suspense>
      );
    });
    expect(screen.getByRole("status", { name: "読み込んでいます" })).toBeInTheDocument();
    await act(async () => {
      first.resolve({ initialPage: { posts: [], nextOffset: null }, initialSpotPage: { spots: [], nextOffset: null }, initialMediaPage: null });
      await first.promise;
      await new Promise((r) => setTimeout(r, 20));
    });
    await waitFor(() => expect(screen.getByText("まだ投稿がありません")).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.queryByRole("status", { name: "読み込んでいます" })).toBeNull();
  });

  it("検索結果: 届くまで骨組み、届いたらスポットカード", async () => {
    const first = deferred<SearchFirstPage>();
    await act(async () => {
      render(
        <Suspense fallback={<CardListSkeleton />}>
          <StreamingSpotSearchScreen context={{ destination: { kind: "prefecture", name: "東京都" } }} initialState={EMPTY_SEARCH_STATE} title="東京都" backHref="/" backLabel="ホーム" fetchPage={vi.fn()} firstPage={first.promise} />
        </Suspense>
      );
    });
    expect(screen.getByRole("status", { name: "読み込んでいます" })).toBeInTheDocument();
    await act(async () => {
      first.resolve({ initialPage: { posts: [], nextOffset: null }, initialSpotPage: { spots: [], nextOffset: null }, initialMediaPage: null });
      await first.promise;
      await new Promise((r) => setTimeout(r, 20));
    });
    await waitFor(() => expect(screen.getByText("条件に合う投稿がありません")).toBeInTheDocument(), { timeout: 3000 });
  });
});
