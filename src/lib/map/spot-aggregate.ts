import { costRangeBounds, durationsMatching } from "@/lib/posts/search-posts";
import type { CostRange } from "@/lib/posts/search-posts";
import { POST_DURATIONS, type PostCategory, type PostDuration } from "@/lib/posts/constants";
import { resolveSpotCategory, type SpotCategoryInput } from "./spot-category";

/**
 * explore-mode Task 4: スポットの代表値と、絞り込みの判断
 * 出典: docs/tasks/map-search/explore-mode/04-filter.md
 *       要件定義書 3.4.6「絞り込み」「スポットの代表値の決め方」・8 章 100
 *
 * 【初心者向け】投稿一覧（3.4.2）は**投稿を 1 件ずつ**絞るが、地図が探しているのは**場所**。
 * そこで「そのスポットを代表する値」で絞る。
 *
 *   「誰かが 1 回だけ 3,000 円で済んだ店」ではなく
 *   「**だいたい 3,000 円の店**」が出るようにする
 *
 * 代表値の決め方（2026-10-02 に決定）
 *   カテゴリ・滞在時間 … いちばん多いもの。同数なら新しい方
 *   予算・評価         … 平均
 *
 * **未入力の投稿は数えない。** 費用と滞在時間は任意の項目なので、入っている投稿だけで出す。
 * 全部未入力のスポットは、その条件で絞ると落ちる（投稿一覧の予算の絞り込みと同じ扱い）。
 *
 * 判断をこのファイルだけに閉じ込めておくと、データの取り方が変わってもここだけテストすれば済む（約束 13）。
 */

/** 代表値を出すために 1 件の投稿から要るもの */
export interface SpotPostInput {
  category: string | null;
  duration: string | null;
  cost: number | null;
  rating: number | null;
  createdAt: string | null;
}

/** スポット 1 つぶんの代表値 */
export interface SpotAggregate {
  postCount: number;
  /** いちばん多いカテゴリ（同数なら新しい方）。無ければ null */
  category: PostCategory | null;
  /** いちばん多い滞在時間（同数なら新しい方）。無ければ null */
  duration: PostDuration | null;
  /** 費用の平均（円）。入力のある投稿が 1 件も無ければ null */
  costAverage: number | null;
  /** 星評価の平均（小数 1 桁）。入力のある投稿が 1 件も無ければ null */
  ratingAverage: number | null;
}

/** 絞り込みの条件（地図だけのもの 2 つを含む） */
export interface SpotFilters {
  categories: readonly PostCategory[];
  cost: CostRange | null;
  duration: PostDuration | null;
  /** 平均の下限（1〜5）。null は条件なし */
  minRating: number | null;
  /** 「タビコエだけの場所」だけを出すか */
  manualOnly: boolean;
}

export const EMPTY_SPOT_FILTERS: SpotFilters = {
  categories: [],
  cost: null,
  duration: null,
  minRating: null,
  manualOnly: false,
};

/** 条件が 1 つでも入っているか（ボタンの色と、0 件のときの文言の出し分けに使う） */
export function hasActiveSpotFilters(filters: SpotFilters): boolean {
  return activeSpotFilterCount(filters) > 0;
}

/** 効いている条件の数（ボタンに付ける数字） */
export function activeSpotFilterCount(filters: SpotFilters): number {
  let count = 0;
  if (filters.categories.length > 0) count += 1;
  if (filters.cost) count += 1;
  if (filters.duration) count += 1;
  if (filters.minRating !== null) count += 1;
  if (filters.manualOnly) count += 1;
  return count;
}

/**
 * いちばん多い滞在時間を返す（同数なら新しい方）。
 *
 * 【初心者向け】カテゴリの `resolveSpotCategory` と同じ考え方。
 * 同じ形で 2 回書くことになるが、**数える対象の型が違う**ので 1 つにまとめると
 * かえって読みにくくなる。決め方が変わったら両方直すこと。
 */
export function resolveSpotDuration(posts: readonly { duration: string | null; createdAt: string | null }[]): PostDuration | null {
  const counts = new Map<PostDuration, { count: number; latest: number }>();
  for (const post of posts) {
    if (!isPostDuration(post.duration)) continue;
    const at = post.createdAt ? Date.parse(post.createdAt) : NaN;
    const current = counts.get(post.duration) ?? { count: 0, latest: Number.NEGATIVE_INFINITY };
    counts.set(post.duration, {
      count: current.count + 1,
      latest: Number.isNaN(at) ? current.latest : Math.max(current.latest, at),
    });
  }
  let best: { duration: PostDuration; count: number; latest: number } | null = null;
  for (const [duration, value] of counts) {
    if (!best || value.count > best.count || (value.count === best.count && value.latest > best.latest)) {
      best = { duration, count: value.count, latest: value.latest };
    }
  }
  return best?.duration ?? null;
}

/** 費用の平均（円、小数を切り捨て）。**未入力は数えない** */
export function averageCost(costs: readonly (number | null)[]): number | null {
  const values = costs.filter((cost): cost is number => typeof cost === "number" && Number.isFinite(cost));
  if (values.length === 0) return null;
  return Math.floor(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/** 星評価の平均（小数 1 桁）。**未入力は数えない** */
export function averageRating(ratings: readonly (number | null)[]): number | null {
  const values = ratings.filter((rating): rating is number => typeof rating === "number" && Number.isFinite(rating));
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

/** そのスポットの公開投稿から代表値を出す */
export function aggregateSpot(posts: readonly SpotPostInput[]): SpotAggregate {
  return {
    postCount: posts.length,
    // カテゴリは**ピンの色を決めている関数をそのまま使う**。別に書くと、
    // カテゴリで絞ったのに違う色のピンが残る（要件 3.4.6）
    category: resolveSpotCategory(posts as readonly SpotCategoryInput[]),
    duration: resolveSpotDuration(posts),
    costAverage: averageCost(posts.map((post) => post.cost)),
    ratingAverage: averageRating(posts.map((post) => post.rating)),
  };
}

/**
 * 代表値が条件に合うか。
 *
 * 【初心者向け】`manual`（タビコエだけの場所か）は投稿ではなくスポットの性質なので、別に受け取る。
 */
export function matchesSpotFilters(
  aggregate: SpotAggregate,
  spot: { manual: boolean },
  filters: SpotFilters
): boolean {
  if (filters.manualOnly && !spot.manual) return false;

  if (filters.categories.length > 0) {
    // 代表カテゴリが無い（全部未入力）スポットは落ちる
    if (!aggregate.category || !filters.categories.includes(aggregate.category)) return false;
  }

  if (filters.duration) {
    // v3.2 と同じく「半日以上」の束を考慮する（旧「それ以上」も含める）
    if (!aggregate.duration || !durationsMatching(filters.duration).includes(aggregate.duration)) return false;
  }

  if (filters.cost) {
    // 費用が全部未入力のスポットは落ちる（投稿一覧の予算の絞り込みと同じ扱い）
    if (aggregate.costAverage === null) return false;
    const { min, max } = costRangeBounds(filters.cost);
    if (aggregate.costAverage < min) return false;
    if (max !== null && aggregate.costAverage > max) return false;
  }

  if (filters.minRating !== null) {
    // 「★4 以上」は 4.0 ちょうどを含む（要件 3.4.6）
    if (aggregate.ratingAverage === null || aggregate.ratingAverage < filters.minRating) return false;
  }

  return true;
}

function isPostDuration(value: string | null): value is PostDuration {
  return value !== null && (POST_DURATIONS as readonly string[]).includes(value);
}
