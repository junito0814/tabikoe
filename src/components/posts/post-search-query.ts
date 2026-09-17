import { POST_CATEGORIES, POST_DURATIONS, type PostCategory, type PostDuration } from "@/lib/posts/constants";
import { parsePostSort, type PostSort } from "@/lib/posts/post-cards";
import {
  COST_RANGES,
  DISTANCE_OPTIONS,
  PERIOD_OPTIONS,
  type CostRange,
  type DistanceOption,
  type PeriodOption,
} from "@/lib/posts/search-posts";
import type { AddModeParams } from "@/lib/search/build-search-href";
import { parseListView, type ListView } from "./ViewToggle";

/**
 * F-MP-04 Task2 / post-timeline Task2〜3（v3.0）: 絞り込み・並び替えの状態 ⇄ URL クエリ
 * 出典: docs/tasks/map-search/post-filter/02-filter-ui.md
 *       docs/tasks/map-search/post-timeline/03-scroll-and-back.md
 *
 * 【初心者向け】v3.0 では「条件は URL に持つ」のが原則（3.4.2）。
 *   - 行き先（pref / lat&lng&q / spot）は SearchContext（画面を開いたときに決まり、画面内では変えない）
 *   - 絞り込み・並び替えは PostSearchState（絞り込みシートやドロップダウンで変わる）
 * 同じ形を 2 つの用途で使う:
 *   1. buildPostSearchParams: GET /api/posts/search のクエリ（offset や閲覧者の現在地も付ける）
 *   2. buildSearchPageHref : ブラウザの URL（/search?…。追加モードの itinerary/day も引き継ぐ）
 * 逆向きの parseSearchState は、URL から画面の初期状態を作る（「一覧に戻る」の復元にも使う）。
 */
export interface PostSearchState {
  /** スポット名の部分一致（v1 からの互換。v3.0 の絞り込みシートには出さない） */
  keyword: string;
  categories: PostCategory[];
  distance: DistanceOption | null;
  cost: CostRange | null;
  duration: PostDuration | null;
  /** v3.0: 期間（訪問日） */
  period: PeriodOption | null;
  /** period が custom のときの日付（YYYY-MM-DD。空なら未指定） */
  from: string;
  to: string;
  sort: PostSort;
  /** v3.0（photo-view）: 投稿一覧か写真グリッドか */
  view: ListView;
}

export const EMPTY_SEARCH_STATE: PostSearchState = {
  keyword: "",
  categories: [],
  distance: null,
  cost: null,
  duration: null,
  period: null,
  from: "",
  to: "",
  sort: "newest",
  view: "posts",
};

/** 画面を開いたときに決まる条件（行き先・追加モード） */
export interface SearchContext {
  destination:
    | { kind: "prefecture"; name: string }
    | { kind: "nearby"; lat: number; lng: number; label: string | null }
    | { kind: "spot"; spotId: string }
    | null;
  addMode?: AddModeParams | null;
}

/** 距離の基準点。駅・現在地（座標）検索のときだけある */
export function distanceCenter(context: SearchContext): { lat: number; lng: number } | null {
  return context.destination?.kind === "nearby" ? { lat: context.destination.lat, lng: context.destination.lng } : null;
}

/** 適用中の絞り込みの種類数（「絞り込み（N）」の N。並び替えは数えない） */
export function countActiveFilters(state: PostSearchState, context: SearchContext): number {
  return (
    (state.keyword.trim() ? 1 : 0) +
    (state.categories.length > 0 ? 1 : 0) +
    (state.distance !== null && distanceCenter(context) ? 1 : 0) +
    (state.cost !== null ? 1 : 0) +
    (state.duration !== null ? 1 : 0) +
    (state.period !== null ? 1 : 0)
  );
}

/** 絞り込み・並び替えのクエリ部分（行き先は含めない） */
function appendStateParams(params: URLSearchParams, state: PostSearchState, context: SearchContext): void {
  const keyword = state.keyword.trim();
  if (keyword) params.set("q", keyword);
  if (state.categories.length > 0) params.set("categories", state.categories.join(","));
  // 距離は基準点が分かっている時だけ意味を持つ
  if (state.distance !== null && distanceCenter(context)) params.set("distance", String(state.distance));
  if (state.cost !== null) params.set("cost", state.cost);
  if (state.duration !== null) params.set("duration", state.duration);
  if (state.period !== null) {
    params.set("period", state.period);
    if (state.period === "custom") {
      if (state.from) params.set("from", state.from);
      if (state.to) params.set("to", state.to);
    }
  }
  if (state.sort !== "newest") params.set("sort", state.sort);
}

/** 写真グリッドは URL に `view=photos` を付ける（API のクエリには載せない） */
function appendViewParam(params: URLSearchParams, state: PostSearchState): void {
  if (state.view === "photos") params.set("view", "photos");
}

function appendDestinationParams(params: URLSearchParams, context: SearchContext): void {
  const destination = context.destination;
  if (!destination) return;
  if (destination.kind === "prefecture") params.set("pref", destination.name);
  else if (destination.kind === "spot") params.set("spot", destination.spotId);
  else {
    params.set("lat", String(destination.lat));
    params.set("lng", String(destination.lng));
    if (destination.label) params.set("q", destination.label);
  }
}

/** GET /api/posts/search のクエリ */
export function buildPostSearchParams(
  state: PostSearchState,
  context: SearchContext,
  offset: number,
  viewer: { lat: number; lng: number } | null = null
): URLSearchParams {
  const params = new URLSearchParams();
  appendDestinationParams(params, context);
  appendStateParams(params, state, context);
  if (viewer) {
    params.set("vlat", String(viewer.lat));
    params.set("vlng", String(viewer.lng));
  }
  if (offset > 0) params.set("offset", String(offset));
  return params;
}

/** ブラウザの URL（/search?…）。条件を URL に持つことで「一覧に戻る」やリロードで再現できる */
export function buildSearchPageHref(state: PostSearchState, context: SearchContext): string {
  const params = new URLSearchParams();
  appendDestinationParams(params, context);
  appendStateParams(params, state, context);
  appendViewParam(params, state);
  if (context.addMode) {
    params.set("itinerary", context.addMode.itinerary);
    if (context.addMode.day) params.set("day", context.addMode.day);
  }
  const query = params.toString();
  return `/search${query ? `?${query}` : ""}`;
}

/** URL クエリ → 絞り込み・並び替えの状態（不正な値は捨てる） */
export function parseSearchState(params: URLSearchParams, context: SearchContext): PostSearchState {
  const includes = <T extends string>(options: readonly T[], value: string | null): value is T =>
    value !== null && (options as readonly string[]).includes(value);
  const categories = (params.get("categories") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is PostCategory => includes(POST_CATEGORIES, item));
  const distanceValue = Number(params.get("distance"));
  const distance = (DISTANCE_OPTIONS as readonly number[]).includes(distanceValue) ? (distanceValue as DistanceOption) : null;
  const cost = params.get("cost");
  const duration = params.get("duration");
  const period = params.get("period");
  const date = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");
  return {
    // 座標付きの q は行き先のラベルなのでキーワードにしない
    keyword: context.destination?.kind === "nearby" ? "" : (params.get("q") ?? "").trim(),
    categories: Array.from(new Set(categories)),
    distance: distanceCenter(context) ? distance : null,
    cost: includes(COST_RANGES, cost) ? cost : null,
    duration: includes(POST_DURATIONS, duration) ? duration : null,
    period: includes(PERIOD_OPTIONS, period) ? period : null,
    from: date(params.get("from")),
    to: date(params.get("to")),
    sort: parsePostSort(params.get("sort")),
    view: parseListView(params.get("view")),
  };
}
