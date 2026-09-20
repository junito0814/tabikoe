"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { walkMinutesBetween } from "@/lib/geo/walk-minutes";
import { SPOT_SORT_LABELS, SPOT_SORTS, type SpotCardData, type SpotCardPage, type SpotSort } from "@/lib/spots/search-spots";
import { PhotoGrid, type FetchMediaPage } from "@/components/media/PhotoGrid";
import type { SpotMediaPage } from "@/lib/posts/search-photos";
import type { ListView } from "@/lib/search/list-view";
import { AddModeBanner, type AddModeInfo } from "./AddModeBanner";
import { FilterSheet } from "./FilterSheet";
import { SortDropdown } from "./SortDropdown";
import { SpotCard } from "./SpotCard";
import { ViewToggle } from "./ViewToggle";
import { buildPostSearchParams, buildSearchPageHref, countActiveFilters, distanceCenter, type PostSearchState, type SearchContext } from "./post-search-query";
import { useInfiniteScroll } from "./use-infinite-scroll";
import { useListRestore, useViewerPosition } from "./use-search-list";

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
  geolocation,
  permissions,
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
  geolocation?: Pick<Geolocation, "getCurrentPosition">;
  permissions?: Pick<Permissions, "query">;
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
  const viewer = useViewerPosition(geolocation, permissions);

  const withWalk = (spot: SpotCardData): SpotCardData => (viewer ? { ...spot, walkMinutes: walkMinutesBetween(viewer, { lat: spot.lat, lng: spot.lng }) } : spot);

  const activeCount = countActiveFilters(state, context);
  const onSortChange = (sort: SpotSort) => applyState({ ...state, sort });
  const onViewChange = (view: ListView) => {
    const next = { ...state, view };
    setState(next);
    router.replace(buildSearchPageHref(next, context), { scroll: false });
  };
  const mediaParams = buildPostSearchParams({ ...state, view: "posts" }, context, 0);
  const isPhotos = state.view === "photos";

  return (
    <div className="flex min-h-screen flex-col items-center bg-app pb-6">
      {addMode && <AddModeBanner info={addMode} />}
      <div className="w-full max-w-[520px] px-4 pt-4">
        <header className="mb-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <Link href={backHref} className="inline-flex h-8 shrink-0 items-center gap-1 text-[12px] font-medium text-muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {backLabel}
            </Link>
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
            <ViewToggle value={state.view} onChange={onViewChange} />
            <SortDropdown<SpotSort> value={state.sort as SpotSort} onChange={onSortChange} options={SPOT_SORTS} labels={SPOT_SORT_LABELS} />
          </div>
        </header>

        {isPhotos ? (
          <PhotoGrid
            key={mediaParams.toString()}
            params={mediaParams}
            initialPage={initialMediaPage && initialMediaPage.key === mediaParams.toString() ? initialMediaPage.page : { items: [], nextOffset: 0 }}
            fetchPage={fetchMediaPage}
          />
        ) : spots.length === 0 && !isLoading && !errorMessage ? (
          <p className="py-16 text-center text-[13px] text-muted">{emptyMessage}</p>
        ) : (
          <ul className="flex flex-col gap-3" data-spot-list>
            {spots.map((spot) => (
              <li key={spot.id}>
                <SpotCard spot={withWalk(spot)} addMode={addMode} backHref={pageHref} />
              </li>
            ))}
          </ul>
        )}

        {!isPhotos && errorMessage && (
          <ErrorNotice className="mt-3" message={errorMessage} onRetry={() => void load(state, spots.length === 0 ? 0 : (nextOffset ?? 0), spots.length === 0)} />
        )}

        <div ref={sentinelRef} aria-hidden className="h-1" />
        {!isPhotos && nextOffset !== null && (
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

      <FilterSheet open={isSheetOpen} value={state} hasDistanceCenter={distanceCenter(context) !== null} onApply={applyState} onClose={() => setIsSheetOpen(false)} />
    </div>
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
