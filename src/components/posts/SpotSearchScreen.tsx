"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { CardListSkeleton } from "@/components/skeleton/Skeletons";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { SPOT_SORT_LABELS, SPOT_SORTS, type SpotCardData, type SpotCardPage, type SpotSort } from "@/lib/spots/search-spots";
import { PhotoGrid, type FetchMediaPage } from "@/components/media/PhotoGrid";
import type { SpotMediaPage } from "@/lib/posts/search-photos";
import type { ListView } from "@/lib/search/list-view";
import { AddModeBanner, type AddModeInfo } from "./AddModeBanner";
import { FilterSheet } from "./FilterSheet";
import { PullToRefresh } from "@/components/layout/PullToRefresh";
import { SortDropdown } from "./SortDropdown";
import { SpotCard } from "./SpotCard";
import { ViewToggle } from "./ViewToggle";
import { SearchMapView } from "./SearchMapView";
import { buildPostSearchParams, buildSearchPageHref, countActiveFilters, type PostSearchState, type SearchContext } from "./post-search-query";
import { useInfiniteScroll } from "./use-infinite-scroll";
import { useListRestore } from "./use-search-list";
import { BackLink } from "@/components/layout/BackLink";

export type FetchSpotPage = (params: URLSearchParams) => Promise<SpotCardPage>;

/**
 * mentoring-7 Task3（v3.1）: 検索結果（都道府県・駅・市区町村）のスポットカード一覧（SC-04）
 * 出典: docs/tasks/shared-ui/mentoring-7/03-spot-cards.md
 *       要件定義書 v3.1 3.4.2（検索結果はスポット単位のカード。並び替え 新着順／評価順／投稿数順）
 *
 * 【初心者向け】PostSearchScreen（投稿カードの一覧）と同じ骨組みで、並べるものがスポットカードになっただけ。
 *   - 条件（絞り込み・並び替え・投稿／写真）は URL に持ち、変えると router.replace で書き換える
 *   - 2 ページ目以降は /api/spots/search で取る（1 ページ目は Server Component が渡す）
 *   - 写真タブは PhotoGrid をそのまま使う（条件は同じで、写真は投稿単位のまま）
 *   - スクロール位置の復元と「徒歩 N 分」は use-search-list.ts のフック
 * スポット別（/search?spot=）は従来どおり PostSearchScreen（SpotPostListScreen）が受け持つ。
 */
export function SpotSearchScreen({
  context,
  initialState,
  initialPage,
  title,
  backHref,
  backLabel,
  addMode = null,
  emptyMessage = "条件に合う投稿がありません",
  fetchPage = defaultFetchSpotPage,
  initialMediaPage = null,
  fetchMediaPage,
}: {
  context: SearchContext;
  initialState: PostSearchState;
  initialPage: SpotCardPage;
  title: string;
  backHref: string;
  backLabel: string;
  addMode?: AddModeInfo | null;
  emptyMessage?: string;
  fetchPage?: FetchSpotPage;
  initialMediaPage?: { key: string; page: SpotMediaPage } | null;
  fetchMediaPage?: FetchMediaPage;
}) {
  const router = useRouter();
  const [state, setState] = useState<PostSearchState>(initialState);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [spots, setSpots] = useState<SpotCardData[]>(initialPage.spots);
  const [nextOffset, setNextOffset] = useState<number | null>(initialPage.nextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const pageHref = buildSearchPageHref(state, context);

  const load = useCallback(
    async (nextState: PostSearchState, offset: number, replace: boolean): Promise<SpotCardPage | null> => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setErrorMessage(null);
      // loading-feedback Task 3（2026-09-30）: 条件を変えたときは古い一覧を残さない（要件 4.5.11 の場面 4）
      if (replace) setSpots([]);
      try {
        const page = await fetchPage(buildPostSearchParams(nextState, context, offset));
        if (requestIdRef.current !== requestId) return null;
        setSpots((current) => (replace ? page.spots : [...current, ...page.spots]));
        setNextOffset(page.nextOffset);
        return page;
      } catch (error) {
        if (error instanceof UnauthorizedError) return null;
        if (requestIdRef.current !== requestId) return null;
        setErrorMessage(ERROR_MESSAGES.dbLoadFailure);
        return null;
      } finally {
        if (requestIdRef.current === requestId) setIsLoading(false);
      }
    },
    [fetchPage, context]
  );

  const applyState = (next: PostSearchState) => {
    setState(next);
    setIsSheetOpen(false);
    router.replace(buildSearchPageHref(next, context), { scroll: false });
    window.scrollTo({ top: 0 });
    void load(next, 0, true);
  };

  const loadMore = useCallback(() => {
    if (isLoading || nextOffset === null) return;
    void load(state, nextOffset, false);
  }, [isLoading, nextOffset, load, state]);

  const sentinelRef = useInfiniteScroll(nextOffset !== null && !isLoading && state.view === "posts", loadMore);

  const loadPage = useCallback(async (offset: number) => (await load(initialState, offset, false))?.nextOffset ?? null, [load, initialState]);
  useListRestore({ pageHref, itemCount: spots.length, initialNextOffset: initialPage.nextOffset, loadPage });



  const activeCount = countActiveFilters(state, context);
  const onSortChange = (sort: SpotSort) => applyState({ ...state, sort });
  const onViewChange = (view: ListView) => {
    const next = { ...state, view };
    setState(next);
    router.replace(buildSearchPageHref(next, context), { scroll: false });
  };
  const mediaParams = buildPostSearchParams({ ...state, view: "posts" }, context, 0);
  const isPhotos = state.view === "photos";
  // #681: 地図タブ（検索結果のときだけ）
  const isMap = state.view === "map";

  /*
   * #673（2026-10-03）: 引っ張って更新。
   *
   * 【初心者向け】ホーム画面から単独のアプリとして開くと**ブラウザの再読み込みが無くなる**ので、
   * 自分で最新にする手段を一覧の画面に用意している（要件 4.5.11 の場面 6・受入条件 96）。
   * この画面（検索結果）は要件で「付ける」としている 6 画面の 1 つだが、2026-10-02 に
   * **包む画面を間違えて**スポット別の一覧（`PostSearchScreen`）の方に付けていた。
   */
  return (
    <PullToRefresh>
      <div className="flex min-h-screen flex-col items-center bg-app pb-6">
        {addMode && <AddModeBanner info={addMode} />}
        <div className="w-full max-w-[520px] px-4 pt-4">
          <header className="mb-3 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              {/* #813: 戻るは共通部品（自前で ‹ を描かない） */}
              <BackLink href={backHref} label={backLabel} />
              <h1 className="min-w-0 flex-1 truncate text-center text-[16px] font-bold text-ink">{title}</h1>
              <button
                type="button"
                onClick={() => setIsSheetOpen(true)}
                aria-haspopup="dialog"
                className="h-8 shrink-0 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-ink"
              >
                絞り込み{activeCount > 0 && `（${activeCount}）`}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <ViewToggle value={state.view} onChange={onViewChange} showMap />
              <SortDropdown<SpotSort> value={state.sort as SpotSort} onChange={onSortChange} options={SPOT_SORTS} labels={SPOT_SORT_LABELS} />
            </div>
          </header>

          {isMap ? (
            <SearchMapView
              spots={spots}
              backHref={pageHref}
              hasMore={nextOffset !== null}
              isLoading={isLoading}
              onLoadMore={loadMore}
            />
          ) : isPhotos ? (
            <PhotoGrid
              key={mediaParams.toString()}
              params={mediaParams}
              initialPage={initialMediaPage && initialMediaPage.key === mediaParams.toString() ? initialMediaPage.page : { items: [], nextOffset: 0 }}
              fetchPage={fetchMediaPage}
            />
          ) : spots.length === 0 && isLoading ? (
            <CardListSkeleton />
          ) : spots.length === 0 && !errorMessage ? (
            <p className="py-16 text-center text-[13px] text-muted">{emptyMessage}</p>
          ) : (
            <ul className="flex flex-col gap-3" data-spot-list>
              {spots.map((spot) => (
                <li key={spot.id}>
                  <SpotCard spot={spot} addMode={addMode} backHref={pageHref} />
                </li>
              ))}
            </ul>
          )}

          {!isPhotos && !isMap && errorMessage && (
            <ErrorNotice className="mt-3" message={errorMessage} onRetry={() => void load(state, spots.length === 0 ? 0 : (nextOffset ?? 0), spots.length === 0)} />
          )}

          <div ref={sentinelRef} aria-hidden className="h-1" />
          {!isPhotos && !isMap && nextOffset !== null && (
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoading}
              className="mt-3 h-10 w-full rounded-[10px] border border-line bg-surface text-[13px] font-semibold text-ink disabled:opacity-45"
            >
              {isLoading ? "読み込み中…" : "もっと見る"}
            </button>
          )}
        </div>

        {/* Task 6: この画面は検索結果（スポットカード）なので「タビコエだけの場所」を出す（要件 3.4.2） */}
        <FilterSheet
          open={isSheetOpen}
          value={state}
            onApply={applyState}
            onClose={() => setIsSheetOpen(false)}
          />
      </div>
    </PullToRefresh>
  );
}

async function defaultFetchSpotPage(params: URLSearchParams): Promise<SpotCardPage> {
  const query = params.toString();
  const response = await fetchWithAuthRedirect(`/api/spots/search${query ? `?${query}` : ""}`);
  if (!response.ok) {
    throw new Error(`Failed to search spots: ${response.status}`);
  }
  return (await response.json()) as SpotCardPage;
}
