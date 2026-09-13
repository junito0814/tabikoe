import type { PostCategory, PostDuration } from "@/lib/posts/constants";
import type { CostRange, DistanceOption } from "@/lib/posts/search-posts";

/**
 * F-MP-04 Task2: 絞り込みUIの選択状態 → GET /api/posts/search のクエリ
 * 出典: docs/tasks/map-search/post-filter/02-filter-ui.md
 *
 * 画面の状態とリクエストパラメータの対応をここに集約し、単体テストで検証できるようにする。
 */
export interface PostSearchState {
  keyword: string;
  categories: PostCategory[];
  distance: DistanceOption | null;
  cost: CostRange | null;
  duration: PostDuration | null;
}

export const EMPTY_SEARCH_STATE: PostSearchState = {
  keyword: "",
  categories: [],
  distance: null,
  cost: null,
  duration: null,
};

export function buildPostSearchParams(
  state: PostSearchState,
  center: { lat: number; lng: number } | null,
  offset: number
): URLSearchParams {
  const params = new URLSearchParams();
  const keyword = state.keyword.trim();
  if (keyword) params.set("q", keyword);
  if (state.categories.length > 0) params.set("categories", state.categories.join(","));
  // 距離は地図の中心が分かっている時だけ意味を持つ
  if (state.distance !== null && center) {
    params.set("distance", String(state.distance));
    params.set("lat", String(center.lat));
    params.set("lng", String(center.lng));
  }
  if (state.cost !== null) params.set("cost", state.cost);
  if (state.duration !== null) params.set("duration", state.duration);
  if (offset > 0) params.set("offset", String(offset));
  return params;
}
