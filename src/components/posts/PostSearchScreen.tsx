"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { appendBackHref } from "@/lib/search/list-state";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { CardListSkeleton } from "@/components/skeleton/Skeletons";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { walkMinutesBetween } from "@/lib/geo/walk-minutes";
import type { PostCardData, PostCardPage, PostSort } from "@/lib/posts/post-cards";
import { PhotoGrid, type FetchMediaPage } from "@/components/media/PhotoGrid";
import type { SpotMediaPage } from "@/lib/posts/search-photos";
import { AddModeBanner, type AddModeInfo } from "./AddModeBanner";
import { FilterSheet } from "./FilterSheet";
import { PostCard } from "./PostCard";
import { SortDropdown } from "./SortDropdown";
import { ViewToggle } from "./ViewToggle";
import type { ListView } from "@/lib/search/list-view";
import {
  buildPostSearchParams,
  buildSearchPageHref,
  countActiveFilters,
  distanceCenter,
  type PostSearchState,
  type SearchContext,
} from "./post-search-query";
import { useInfiniteScroll } from "./use-infinite-scroll";
import { useListRestore, useViewerPosition } from "./use-search-list";
import { PullToRefresh } from "@/components/layout/PullToRefresh";

export type FetchSearchPage = (params: URLSearchParams) => Promise<PostCardPage>;

/**
 * post-timeline Task2〜4（v3.0）: 投稿一覧（SC-04、タイムライン形式）
 * 出典: docs/tasks/map-search/post-timeline/02-timeline-ui.md
 *       docs/tasks/map-search/post-timeline/03-scroll-and-back.md
 *       docs/tasks/map-search/post-timeline/04-spot-list-header-and-add-mode.md
 *       要件定義書 v3.0 3.4.2・3.4.3
 *
 * 【初心者向け】検索結果（都道府県・駅・スポット別）で共通の画面。
 *   - 行き先は `context`（開いたときに決まる）。絞り込み・並び替えは `state`
 *   - state を変えると URL も書き換える（router.replace）。URL がそのまま条件なので、リロードや「一覧に戻る」で再現できる
 *   - スクロール位置と読み込み済みページ数は sessionStorage（lib/search/list-state.ts）に保存し、同じ URL で開き直したら復元する
 *   - 「徒歩 N 分」は位置情報の許可が既に出ているときだけ、画面側で計算して足す（許可ダイアログはここでは出さない）
 *   - `requestIdRef` は古い応答で画面を上書きしないための番号（並び替えを素早く 2 回変えたときなど）
 * スポット別一覧の見出し（SpotPostListScreen）は `header` に差し込む。
 */
export function PostSearchScreen({
  context,
  initialState,
  initialPage,
  title,
  backHref,
  backLabel,
  backParam = null,
  header,
  addMode = null,
  emptyMessage = "条件に合う投稿がありません",
  fetchPage = defaultFetchPage,
  initialMediaPage = null,
  fetchMediaPage,
  geolocation,
  permissions,
}: {
  context: SearchContext;
  /** URL から読んだ絞り込み・並び替え */
  initialState: PostSearchState;
  /** 1 ページ目。Server Component が取得して渡す */
  initialPage: PostCardPage;
  /** 見出し（大阪府／大阪駅／スポット名） */
  title: string;
  backHref: string;
  backLabel: string;
  /** Bug #469: この一覧自身が受け取った戻り先（`back=`）。投稿詳細へ渡す一覧 URL に付け直して数珠つなぎにする */
  backParam?: string | null;
  /** 見出しの下に差し込む要素（スポット別の情報行など） */
  header?: ReactNode;
  addMode?: AddModeInfo | null;
  emptyMessage?: string;
  /** 差し替え口（単体テスト用） */
  fetchPage?: FetchSearchPage;
  /** 写真グリッド（?view=photos）の 1 ページ目。Server Component が取得して渡す（key は取得時の条件） */
  initialMediaPage?: { key: string; page: SpotMediaPage } | null;
  /** 差し替え口（単体テスト用） */
  fetchMediaPage?: FetchMediaPage;
  geolocation?: Pick<Geolocation, "getCurrentPosition">;
  permissions?: Pick<Permissions, "query">;
}) {
  const router = useRouter();
  const [state, setState] = useState<PostSearchState>(initialState);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [posts, setPosts] = useState<PostCardData[]>(initialPage.posts);
  const [nextOffset, setNextOffset] = useState<number | null>(initialPage.nextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const pageHref = buildSearchPageHref(state, context);

  const load = useCallback(
    async (nextState: PostSearchState, offset: number, replace: boolean): Promise<PostCardPage | null> => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setErrorMessage(null);
      // loading-feedback Task 3（2026-09-30）: 条件を変えたときは古い一覧を残さない。
      // 残すと「絞り込んだのに変わっていない」ように見える（要件 4.5.11 の場面 4）。
      // 追加読み込み（replace が false）では消さない
      if (replace) setPosts([]);
      try {
        const page = await fetchPage(buildPostSearchParams(nextState, context, offset));
        if (requestIdRef.current !== requestId) return null;
        setPosts((current) => (replace ? page.posts : [...current, ...page.posts]));
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

  // 条件が変わったら URL を書き換えて 1 ページ目から取り直す
  const applyState = (next: PostSearchState) => {
    setState(next);
    setIsSheetOpen(false);
    // Bug #483: 戻り先（back）を落とさずに URL を書き換える（落とすと戻るが既定の「地図」に変わる）
    router.replace(appendBackHref(buildSearchPageHref(next, context), backParam), { scroll: false });
    window.scrollTo({ top: 0 });
    void load(next, 0, true);
  };

  const loadMore = useCallback(() => {
    if (isLoading || nextOffset === null) return;
    void load(state, nextOffset, false);
  }, [isLoading, nextOffset, load, state]);

  const sentinelRef = useInfiniteScroll(nextOffset !== null && !isLoading && state.view === "posts", loadMore);

  // ── Task3: 「一覧に戻る」の復元と保存、「徒歩 N 分」の現在地（use-search-list.ts に共通化。v3.1） ──
  const loadPage = useCallback(async (offset: number) => (await load(initialState, offset, false))?.nextOffset ?? null, [load, initialState]);
  useListRestore({ pageHref, itemCount: posts.length, initialNextOffset: initialPage.nextOffset, loadPage });
  const viewer = useViewerPosition(geolocation, permissions);

  const withWalk = (post: PostCardData): PostCardData =>
    viewer ? { ...post, walkMinutes: walkMinutesBetween(viewer, { lat: post.spotLat, lng: post.spotLng }) } : post;

  const activeCount = countActiveFilters(state, context);
  const onSortChange = (sort: PostSort) => applyState({ ...state, sort });
  // スポット別の並び替え（新着順／評価順／いいね順）。検索結果のスポットカードは SpotSearchScreen 側
  // 写真切替: 投稿一覧は取り直さず URL だけ変える（戻したときに一覧が残っている）
  const onViewChange = (view: ListView) => {
    const next = { ...state, view };
    setState(next);
    router.replace(appendBackHref(buildSearchPageHref(next, context), backParam), { scroll: false });
  };
  // 写真グリッドに渡す条件（投稿一覧と同じ。offset と view は含めない）
  const mediaParams = buildPostSearchParams({ ...state, view: "posts" }, context, 0);
  const isPhotos = state.view === "photos";

  return (
    <PullToRefresh>
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
            {header}
            <div className="flex items-center justify-between gap-2">
              <ViewToggle value={state.view} onChange={onViewChange} />
              <SortDropdown value={state.sort as PostSort} onChange={onSortChange} />
            </div>
          </header>

          {isPhotos ? (
            <PhotoGrid
              key={mediaParams.toString()}
              params={mediaParams}
              initialPage={initialMediaPage && initialMediaPage.key === mediaParams.toString() ? initialMediaPage.page : { items: [], nextOffset: 0 }}
              fetchPage={fetchMediaPage}
            />
          ) : posts.length === 0 && isLoading ? (
            <CardListSkeleton />
          ) : posts.length === 0 && !errorMessage ? (
            <p className="py-16 text-center text-[13px] text-muted">{emptyMessage}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {posts.map((post) => (
                <li key={post.id}>
                  <PostCard post={withWalk(post)} backHref={appendBackHref(pageHref, backParam)} showSpotName={context.destination?.kind !== "spot"} addMode={addMode} />
                </li>
              ))}
            </ul>
          )}

          {!isPhotos && errorMessage && (
            <ErrorNotice
              className="mt-3"
              message={errorMessage}
              onRetry={() => void load(state, posts.length === 0 ? 0 : (nextOffset ?? 0), posts.length === 0)}
            />
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

        <FilterSheet
          open={isSheetOpen}
          value={state}
          hasDistanceCenter={distanceCenter(context) !== null}
          onApply={applyState}
          onClose={() => setIsSheetOpen(false)}
        />
      </div>
    </PullToRefresh>
  );
}

async function defaultFetchPage(params: URLSearchParams): Promise<PostCardPage> {
  const query = params.toString();
  const response = await fetchWithAuthRedirect(`/api/posts/search${query ? `?${query}` : ""}`);
  if (!response.ok) {
    throw new Error(`Failed to search posts: ${response.status}`);
  }
  return (await response.json()) as PostCardPage;
}
