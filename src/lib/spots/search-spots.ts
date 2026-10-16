import type { SupabaseClient } from "@supabase/supabase-js";
import { walkMinutesBetween } from "@/lib/geo/walk-minutes";
import { getBlockedUserIds } from "@/lib/blocks/get-blocked-user-ids";
import { createPostPhotoUrls } from "@/lib/posts/signed-url";
import { findSavedSpotIds } from "./saved-spots";
import { findLatestSpotStatuses, representativeMedia } from "@/lib/posts/post-cards";
import { applyFilters, baseQuery, matchesCostRange, matchesFilters, SEARCH_PAGE_SIZE, type CostRange, type PostSearchFilters, type SearchRow } from "@/lib/posts/search-posts";
import { resolveSpotCategory } from "@/lib/map/spot-category";
import type { PostCategory } from "@/lib/posts/constants";

/**
 * mentoring-7 Task3（v3.1）: 検索結果のスポット単位化
 * 出典: docs/tasks/shared-ui/mentoring-7/03-spot-cards.md
 *       要件定義書 v3.1 3.4.2（検索結果はスポットカード。並び替えは 新着順／評価順／投稿数順）
 *
 * 【初心者向け】投稿の検索（search-posts.ts）と同じ条件で「条件に合う公開投稿があるスポット」を返す。
 * DB にスポット単位の集計列は無いので、条件に合う投稿を上限まで取ってから、ここでスポットごとにまとめる
 * （★の平均・投稿件数・最新の投稿の感想と写真）。いいね順（searchByLikes）と同じやり方。
 * まとめる部分（aggregateSpotCards）と並べる部分（sortSpotCards）は純粋関数にして単体テストの対象にする。
 */
export const SPOT_SORTS = ["newest", "rating", "count"] as const;
export type SpotSort = (typeof SPOT_SORTS)[number];
export const SPOT_SORT_LABELS: Record<SpotSort, string> = {
  newest: "新着順",
  rating: "評価順",
  count: "投稿数順",
};
export function parseSpotSort(value: string | null): SpotSort {
  return (SPOT_SORTS as readonly string[]).includes(value ?? "") ? (value as SpotSort) : "newest";
}

export interface SpotCardData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  prefecture: string | null;
  /** 手動登録＝「タビコエだけの場所」 */
  isManualSpot: boolean;
  /** 条件に合う公開投稿の件数 */
  postCount: number;
  /** ★の平均（小数 1 桁）。評価の無い投稿は除いて平均する */
  averageRating: number | null;
  /**
   * #741: スポットの代表カテゴリ（ピンの色と記号を決める）。
   * **ピンの色を決めているのと同じ関数**（`resolveSpotCategory`）で出すので、地図と一覧で食い違わない。
   */
  category: PostCategory | null;
  /** 最新の投稿の 1 枚目 */
  coverUrl: string | null;
  coverMediaType: "photo" | "video" | null;
  /** 最新の投稿の感想の冒頭（1 行分） */
  latestComment: string | null;
  latestPostAt: string;
  latestStatus: { status: "still_there" | "gone"; reportedAt: string } | null;
  /** 現在地があるときだけ（直線距離 ÷ 80m/分） */
  walkMinutes: number | null;
  /** 行きたいに保存済みか（SaveButton の初期状態） */
  viewerHasSaved: boolean;
}

export interface SpotCardPage {
  spots: SpotCardData[];
  nextOffset: number | null;
}

/** 集計のために読む投稿の上限（都道府県 1 つ分でもこれで足りる規模を想定） */
const SPOT_SEARCH_FETCH_CAP = 1000;

/** 集計前のスポット（署名 URL を付ける前） */
export interface SpotAggregate {
  id: string;
  name: string;
  lat: number;
  lng: number;
  prefecture: string | null;
  source: string;
  postCount: number;
  ratingSum: number;
  ratingCount: number;
  /** #955: 平均予算を出すための材料。費用が未入力（null）の投稿は数に入れない */
  costSum: number;
  costCount: number;
  latestPostAt: string;
  latestComment: string | null;
  coverPath: string | null;
  coverMediaType: "photo" | "video" | null;
  /** #741: 代表カテゴリを出すための材料（投稿のカテゴリと日付） */
  categoryInputs: { category: string; createdAt: string }[];
}

/** 投稿の行をスポットごとにまとめる（純粋関数）。行は新着順で渡す前提（先頭が最新） */
export function aggregateSpotCards(rows: SearchRow[]): SpotAggregate[] {
  const bySpot = new Map<string, SpotAggregate>();
  for (const row of rows) {
    const spot = row.spots;
    let agg = bySpot.get(spot.id);
    if (!agg) {
      const media = representativeMedia(row.post_photos);
      agg = {
        id: spot.id,
        name: spot.name,
        lat: spot.lat,
        lng: spot.lng,
        prefecture: spot.prefecture,
        source: spot.source,
        postCount: 0,
        ratingSum: 0,
        ratingCount: 0,
        costSum: 0,
        costCount: 0,
        // #741: 代表カテゴリを出すために、投稿のカテゴリと日付を集める
        categoryInputs: [],
        latestPostAt: row.created_at,
        latestComment: firstLine(row.comment),
        coverPath: media?.storage_url ?? null,
        coverMediaType: media ? (media.media_type === "video" ? "video" : "photo") : null,
      };
      bySpot.set(spot.id, agg);
    }
    agg.postCount += 1;
    agg.categoryInputs.push({ category: row.category, createdAt: row.created_at });
    if (typeof row.rating === "number") {
      agg.ratingSum += row.rating;
      agg.ratingCount += 1;
    }
    // #955: 費用は未入力があるので、入っているものだけで平均を出す
    if (typeof row.cost === "number") {
      agg.costSum += row.cost;
      agg.costCount += 1;
    }
    // 先頭が最新なので latest* は最初の行のまま。ただし感想が空なら後の行から補う
    if (agg.latestComment === null) agg.latestComment = firstLine(row.comment);
    if (agg.coverPath === null) {
      const media = representativeMedia(row.post_photos);
      if (media?.storage_url) {
        agg.coverPath = media.storage_url;
        agg.coverMediaType = media.media_type === "video" ? "video" : "photo";
      }
    }
  }
  return Array.from(bySpot.values());
}

/**
 * #955（2026-10-16）: スポットの一覧を**平均**で絞る（純粋関数）
 * 出典: 要件定義書 3.4.2・4.5.19
 *
 * 【初心者向け】検索結果は**スポットの一覧**なのに、これまで**投稿単位の条件**で絞っていました。
 * 1 件 5,000 円の投稿があるだけで「5,000 円の店」として出てしまい、平均が 1,000 円でも同じ扱いでした。
 * Google マップも食べログも、場所の一覧は**その場所の平均**で絞ります。
 *
 * カテゴリと滞在時間は**投稿単位のまま**です（「そのカテゴリの投稿があるスポット」でよく、
 * 画面のラベルにも「平均」と書いていないため）。平均にするのは**予算と評価だけ**。
 *
 * 材料が無いスポット（費用が未入力ばかり／星が無い）は、**その条件で絞ったときは出しません**
 * （費用で絞ると未入力の投稿が出ないのと同じ考え方。要件 3.4.4）。
 */
export function filterSpotsByAverage<T extends { ratingSum: number; ratingCount: number; costSum: number; costCount: number }>(
  spots: T[],
  { cost, minRating }: { cost: CostRange | null; minRating: number | null }
): T[] {
  return spots.filter((spot) => {
    if (cost !== null) {
      if (spot.costCount === 0) return false;
      if (!matchesCostRange(Math.round(spot.costSum / spot.costCount), cost)) return false;
    }
    if (minRating !== null) {
      if (spot.ratingCount === 0) return false;
      if (spot.ratingSum / spot.ratingCount < minRating) return false;
    }
    return true;
  });
}

/**
 * #929-c（2026-10-17）: 「行ってわかったこと」で絞る（純粋関数）。
 *
 * 【初心者向け】**どのスポットが残るか**は `visit-findings.ts` の
 * `spotIdsWithAllFindings` が決めていて、ここは受け取った集合で選ぶだけです。
 * 地図の探すモード（spot-aggregate.ts）も同じ集合を使うので、答えが食い違いません。
 * `null` は「条件なし」で、そのときは何も落としません。
 */
export function filterSpotsByIds<T extends { id: string }>(spots: T[], allowedSpotIds: ReadonlySet<string> | null): T[] {
  return allowedSpotIds === null ? spots : spots.filter((spot) => allowedSpotIds.has(spot.id));
}

/** 並び替え（純粋関数）。同点は新しい投稿がある順 */
export function sortSpotCards<T extends { latestPostAt: string; postCount: number; ratingSum: number; ratingCount: number }>(spots: T[], sort: SpotSort): T[] {
  const avg = (s: T) => (s.ratingCount > 0 ? s.ratingSum / s.ratingCount : -1);
  return [...spots].sort((a, b) => {
    if (sort === "rating" && avg(a) !== avg(b)) return avg(b) - avg(a);
    if (sort === "count" && a.postCount !== b.postCount) return b.postCount - a.postCount;
    return b.latestPostAt.localeCompare(a.latestPostAt);
  });
}

function firstLine(comment: string | null): string | null {
  const line = (comment ?? "").split(/\r?\n/)[0]?.trim() ?? "";
  return line.length > 0 ? line : null;
}

/** 検索条件に合うスポットを 1 ページ（20 件）返す */
export async function searchSpotCards(
  admin: SupabaseClient,
  viewerId: string,
  filters: PostSearchFilters,
  sort: SpotSort,
  offset: number,
  limit: number = SEARCH_PAGE_SIZE,
  /** #955: 平均評価の下限（1〜5）。絞り込みシートの「評価（平均）」から来る */
  minRating: number | null = null,
  /**
   * #929: 「行ってわかったこと」で残ったスポットの id（`findSpotIdsWithAllFindings` の結果）。
   * `null` は条件なし。**この関数の中では DB を引かない**ので、呼ぶ側が渡す
   * （`visit-findings-db.ts` はサーバー専用で、このファイルは画面側からも型を読まれるため）
   */
  allowedSpotIds: ReadonlySet<string> | null = null
): Promise<SpotCardPage> {
  const blockedIds = await getBlockedUserIds(admin, viewerId);
  /*
   * #955: **予算は投稿単位で絞らない**。平均を出すには、その スポットの投稿を全部足す必要があるため。
   * 絞るのは集計のあと（filterSpotsByAverage）。カテゴリ・滞在時間・行き先・期間は今までどおり投稿単位。
   */
  const postFilters: PostSearchFilters = { ...filters, costRange: null };
  const { data, error } = await applyFilters(baseQuery(admin, "newest"), postFilters, blockedIds).limit(SPOT_SEARCH_FETCH_CAP);
  if (error) throw error;
  const rows = ((data ?? []) as unknown as SearchRow[]).filter((row) => matchesFilters({ ...row, spot: row.spots }, postFilters));

  const matched = filterSpotsByIds(aggregateSpotCards(rows), allowedSpotIds);
  const sorted = sortSpotCards(filterSpotsByAverage(matched, { cost: filters.costRange, minRating }), sort);
  const page = sorted.slice(offset, offset + limit);
  const spotIds = page.map((spot) => spot.id);

  const [urls, statuses, saved] = await Promise.all([
    createPostPhotoUrls(admin, Array.from(new Set(page.flatMap((spot) => (spot.coverPath ? [spot.coverPath] : []))))),
    findLatestSpotStatuses(admin, spotIds),
    findSavedSpotIds(admin, viewerId, spotIds),
  ]);

  const spots: SpotCardData[] = page.map((spot) => ({
    id: spot.id,
    name: spot.name,
    lat: spot.lat,
    lng: spot.lng,
    prefecture: spot.prefecture,
    isManualSpot: spot.source === "manual",
    postCount: spot.postCount,
    averageRating: spot.ratingCount > 0 ? Math.round((spot.ratingSum / spot.ratingCount) * 10) / 10 : null,
    category: resolveSpotCategory(spot.categoryInputs),
    coverUrl: spot.coverPath ? (urls.get(spot.coverPath) ?? null) : null,
    coverMediaType: spot.coverMediaType,
    latestComment: spot.latestComment,
    latestPostAt: spot.latestPostAt,
    latestStatus: statuses.get(spot.id) ?? null,
    walkMinutes: walkMinutesBetween(filters.viewer ?? null, { lat: spot.lat, lng: spot.lng }),
    viewerHasSaved: saved.has(spot.id),
  }));
  return { spots, nextOffset: offset + limit < sorted.length ? offset + limit : null };
}


