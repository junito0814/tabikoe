"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { walkMinutesBetween } from "@/lib/geo/walk-minutes";
import { requestCurrentPosition } from "@/lib/geo/use-current-position";
import type { PostCardData, PostCardPage, PostSort } from "@/lib/posts/post-cards";
import { loadListState, saveListState } from "@/lib/search/list-state";
import { AddModeBanner, type AddModeInfo } from "./AddModeBanner";
import { FilterSheet } from "./FilterSheet";
import { PostCard } from "./PostCard";
import { SortDropdown } from "./SortDropdown";
import {
  buildPostSearchParams,
  buildSearchPageHref,
  countActiveFilters,
  distanceCenter,
  type PostSearchState,
  type SearchContext,
} from "./post-search-query";
import { useInfiniteScroll } from "./use-infinite-scroll";

export type FetchSearchPage = (params: URLSearchParams) => Promise<PostCardPage>;

/** 1 ページの件数（サーバー側の既定と揃える） */
const PAGE_SIZE = 20;

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
  header,
  addMode = null,
  emptyMessage = "条件に合う投稿がありません",
  fetchPage = defaultFetchPage,
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
  /** 見出しの下に差し込む要素（スポット別の情報行など） */
  header?: ReactNode;
  addMode?: AddModeInfo | null;
  emptyMessage?: string;
  /** 差し替え口（単体テスト用） */
  fetchPage?: FetchSearchPage;
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
  const [viewer, setViewer] = useState<{ lat: number; lng: number } | null>(null);
  const requestIdRef = useRef(0);
  const pageHref = buildSearchPageHref(state, context);

  const load = useCallback(
    async (nextState: PostSearchState, offset: number, replace: boolean): Promise<PostCardPage | null> => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setErrorMessage(null);
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
    router.replace(buildSearchPageHref(next, context), { scroll: false });
    window.scrollTo({ top: 0 });
    void load(next, 0, true);
  };

  const loadMore = useCallback(() => {
    if (isLoading || nextOffset === null) return;
    void load(state, nextOffset, false);
  }, [isLoading, nextOffset, load, state]);

  const sentinelRef = useInfiniteScroll(nextOffset !== null && !isLoading, loadMore);

  // ── Task3: 「一覧に戻る」の復元 ─────────────────────────────
  // 初回だけ: 保存された状態があれば同じページ数まで読み込み、スクロール位置を戻す
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const saved = loadListState(pageHref);
    if (!saved) return;
    let cancelled = false;
    const restore = async () => {
      let offset: number | null = initialPage.nextOffset;
      for (let pageNo = 2; pageNo <= saved.loadedPages && offset !== null && !cancelled; pageNo++) {
        const page = await load(initialState, offset, false);
        offset = page?.nextOffset ?? null;
      }
      if (!cancelled) {
        // 描画が終わってからスクロールする（同期だと高さが足りず途中で止まる）
        requestAnimationFrame(() => window.scrollTo({ top: saved.scrollY }));
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [pageHref, initialPage.nextOffset, initialState, load]);

  // スクロールのたび（間引き）と離脱時に保存
  const loadedPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  useEffect(() => {
    if (typeof window === "undefined") return;
    let frame = 0;
    const save = () => saveListState(pageHref, { scrollY: window.scrollY, loadedPages });
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        save();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
      if (frame) cancelAnimationFrame(frame);
      save();
    };
  }, [pageHref, loadedPages]);

  // ── 「徒歩 N 分」: 許可済みのときだけ現在地を取る（ダイアログは出さない） ──
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const perms = permissions ?? (typeof navigator === "undefined" ? undefined : navigator.permissions);
      if (!perms?.query) return;
      try {
        const status = await perms.query({ name: "geolocation" });
        if (status.state !== "granted" || cancelled) return;
        const result = await requestCurrentPosition(geolocation ?? navigator.geolocation);
        if (result.ok && !cancelled) setViewer({ lat: result.lat, lng: result.lng });
      } catch {
        // Permissions API 非対応ブラウザでは徒歩分を出さない
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [geolocation, permissions]);

  const withWalk = (post: PostCardData): PostCardData =>
    viewer ? { ...post, walkMinutes: walkMinutesBetween(viewer, { lat: post.spotLat, lng: post.spotLng }) } : post;

  const activeCount = countActiveFilters(state, context);
  const onSortChange = (sort: PostSort) => applyState({ ...state, sort });

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
          {header}
          <div className="flex items-center justify-end gap-2">
            <SortDropdown value={state.sort} onChange={onSortChange} />
          </div>
        </header>

        {posts.length === 0 && !isLoading && !errorMessage ? (
          <p className="py-16 text-center text-[13px] text-muted">{emptyMessage}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={withWalk(post)} backHref={pageHref} showSpotName={context.destination?.kind !== "spot"} />
              </li>
            ))}
          </ul>
        )}

        {errorMessage && (
          <ErrorNotice
            className="mt-3"
            message={errorMessage}
            onRetry={() => void load(state, posts.length === 0 ? 0 : (nextOffset ?? 0), posts.length === 0)}
          />
        )}

        <div ref={sentinelRef} aria-hidden className="h-1" />
        {nextOffset !== null && (
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
