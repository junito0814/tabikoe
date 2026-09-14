"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { POST_CATEGORIES, POST_DURATIONS, type PostCategory } from "@/lib/posts/constants";
import type { PostCardData, PostCardPage } from "@/lib/posts/post-cards";
import {
  COST_RANGE_LABELS,
  COST_RANGES,
  DISTANCE_LABELS,
  DISTANCE_OPTIONS,
} from "@/lib/posts/search-posts";
import { PostCard } from "./PostCard";
import { buildPostSearchParams, EMPTY_SEARCH_STATE, type PostSearchState } from "./post-search-query";
import { useInfiniteScroll } from "./use-infinite-scroll";

export type FetchSearchPage = (params: URLSearchParams) => Promise<PostCardPage>;

/**
 * F-MP-04 Task2: 絞り込みUI（SC-04・検索モード）
 * 出典: docs/tasks/map-search/post-filter/02-filter-ui.md
 *
 * 全体マップの「投稿を検索」から開く。距離の基準は地図の中心（クエリの lat/lng）で、
 * 地名検索（F-MP-02）はこの画面の条件に影響しない（3.4.2）。20件ずつの無限スクロール。
 */
export function PostSearchScreen({
  center,
  initialPage,
  fetchPage = defaultFetchPage,
}: {
  center: { lat: number; lng: number } | null;
  /** 条件なし（新着順）の1ページ目。Server Component が取得して渡す */
  initialPage: PostCardPage;
  /** 差し替え口（単体テスト用） */
  fetchPage?: FetchSearchPage;
}) {
  const [draft, setDraft] = useState<PostSearchState>(EMPTY_SEARCH_STATE);
  const [applied, setApplied] = useState<PostSearchState>(EMPTY_SEARCH_STATE);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [posts, setPosts] = useState<PostCardData[]>(initialPage.posts);
  const [nextOffset, setNextOffset] = useState<number | null>(initialPage.nextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (state: PostSearchState, offset: number, replace: boolean) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const page = await fetchPage(buildPostSearchParams(state, center, offset));
        if (requestIdRef.current !== requestId) return;
        setPosts((current) => (replace ? page.posts : [...current, ...page.posts]));
        setNextOffset(page.nextOffset);
      } catch (error) {
        if (error instanceof UnauthorizedError) return;
        if (requestIdRef.current !== requestId) return;
        setErrorMessage(ERROR_MESSAGES.dbLoadFailure);
      } finally {
        if (requestIdRef.current === requestId) setIsLoading(false);
      }
    },
    [fetchPage, center]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setApplied(draft);
    setIsPanelOpen(false);
    void load(draft, 0, true);
  };

  const handleReset = () => {
    setDraft(EMPTY_SEARCH_STATE);
    setApplied(EMPTY_SEARCH_STATE);
    void load(EMPTY_SEARCH_STATE, 0, true);
  };

  const loadMore = useCallback(() => {
    if (isLoading || nextOffset === null) return;
    void load(applied, nextOffset, false);
  }, [isLoading, nextOffset, load, applied]);

  const sentinelRef = useInfiniteScroll(nextOffset !== null && !isLoading, loadMore);

  const toggleCategory = (category: PostCategory) => {
    setDraft((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }));
  };

  const activeCount =
    (applied.keyword.trim() ? 1 : 0) +
    (applied.categories.length > 0 ? 1 : 0) +
    (applied.distance !== null ? 1 : 0) +
    (applied.cost !== null ? 1 : 0) +
    (applied.duration !== null ? 1 : 0);

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#FBF6F0] px-4 py-6">
      <div className="w-full max-w-[520px]">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-[18px] font-bold text-[#3D3A35]">投稿を検索</h1>
          <Link href="/map" className="text-[12px] font-medium text-[#9C9488] underline underline-offset-2">
            地図へ戻る
          </Link>
        </header>

        <form onSubmit={handleSubmit} className="mb-4 flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="search"
              value={draft.keyword}
              onChange={(event) => setDraft((current) => ({ ...current, keyword: event.target.value }))}
              placeholder="スポット名で検索"
              aria-label="キーワード（スポット名）"
              className="h-11 min-w-0 flex-1 rounded-[10px] border border-[#E8E1D8] bg-white px-3 text-[14px] text-[#3D3A35] focus:outline-none focus:ring-1 focus:ring-[#C4703F]"
            />
            <button
              type="button"
              onClick={() => setIsPanelOpen((open) => !open)}
              aria-expanded={isPanelOpen}
              aria-controls="post-filter-panel"
              className="h-11 shrink-0 rounded-[10px] border border-[#E8E1D8] bg-white px-3 text-[12px] font-semibold text-[#3D3A35]"
            >
              絞り込み{activeCount > 0 && `（${activeCount}）`}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="h-11 shrink-0 rounded-[10px] bg-[#C4703F] px-4 text-[13px] font-semibold text-white disabled:opacity-45"
            >
              検索
            </button>
          </div>

          <div
            id="post-filter-panel"
            hidden={!isPanelOpen}
            className="flex flex-col gap-4 rounded-[12px] border border-[#E8E1D8] bg-white p-4"
          >
            <fieldset>
              <legend className="mb-1.5 text-[12px] font-medium text-[#9C9488]">カテゴリ（複数選択可）</legend>
              <div className="flex flex-wrap gap-1.5">
                {POST_CATEGORIES.map((category) => {
                  const checked = draft.categories.includes(category);
                  return (
                    <label
                      key={category}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                        checked ? "border-[#C4703F] bg-[#C4703F] text-white" : "border-[#E8E1D8] text-[#3D3A35]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(category)}
                        className="sr-only"
                      />
                      {category}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1.5 text-[12px] font-medium text-[#9C9488]">
                距離（地図の中心から）{!center && <span className="ml-1 text-[#C4703F]">※地図から開くと使えます</span>}
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {DISTANCE_OPTIONS.map((option) => (
                  <label
                    key={option}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                      draft.distance === option ? "border-[#C4703F] bg-[#C4703F] text-white" : "border-[#E8E1D8] text-[#3D3A35]"
                    } ${!center ? "opacity-45" : ""}`}
                  >
                    <input
                      type="radio"
                      name="distance"
                      disabled={!center}
                      checked={draft.distance === option}
                      onChange={() => setDraft((current) => ({ ...current, distance: option }))}
                      className="sr-only"
                    />
                    {DISTANCE_LABELS[option]}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1.5 text-[12px] font-medium text-[#9C9488]">費用（1人あたり）</legend>
              <div className="flex flex-wrap gap-1.5">
                {COST_RANGES.map((range) => (
                  <label
                    key={range}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                      draft.cost === range ? "border-[#C4703F] bg-[#C4703F] text-white" : "border-[#E8E1D8] text-[#3D3A35]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cost"
                      checked={draft.cost === range}
                      onChange={() => setDraft((current) => ({ ...current, cost: range }))}
                      className="sr-only"
                    />
                    {COST_RANGE_LABELS[range]}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1.5 text-[12px] font-medium text-[#9C9488]">滞在時間</legend>
              <div className="flex flex-wrap gap-1.5">
                {POST_DURATIONS.map((option) => (
                  <label
                    key={option}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                      draft.duration === option ? "border-[#C4703F] bg-[#C4703F] text-white" : "border-[#E8E1D8] text-[#3D3A35]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="duration"
                      checked={draft.duration === option}
                      onChange={() => setDraft((current) => ({ ...current, duration: option }))}
                      className="sr-only"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex justify-between">
              <button type="button" onClick={handleReset} className="text-[12px] font-medium text-[#9C9488] underline underline-offset-2">
                条件をクリア
              </button>
              <button type="submit" className="h-9 rounded-[8px] bg-[#3D3A35] px-4 text-[12px] font-semibold text-white">
                この条件で検索
              </button>
            </div>
          </div>
        </form>

        {posts.length === 0 && !isLoading && !errorMessage ? (
          <p className="py-16 text-center text-[13px] text-[#9C9488]">条件に合う投稿がありません</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} showSpotName />
              </li>
            ))}
          </ul>
        )}

        {errorMessage && (
          <ErrorNotice className="mt-3" message={errorMessage} onRetry={() => void load(applied, posts.length === 0 ? 0 : (nextOffset ?? 0), posts.length === 0)} />
        )}

        <div ref={sentinelRef} aria-hidden className="h-1" />
        {nextOffset !== null && (
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoading}
            className="mt-3 h-10 w-full rounded-[10px] border border-[#E8E1D8] bg-white text-[13px] font-semibold text-[#3D3A35] disabled:opacity-45"
          >
            {isLoading ? "読み込み中…" : "もっと見る"}
          </button>
        )}
      </div>
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
