import type { SupabaseClient } from "@supabase/supabase-js";
import { walkMinutesBetween } from "@/lib/geo/walk-minutes";
import { getBlockedUserIds } from "@/lib/blocks/get-blocked-user-ids";
import { createPostPhotoUrls } from "@/lib/posts/signed-url";
import { findLatestSpotStatuses, representativeMedia } from "@/lib/posts/post-cards";
import { applyFilters, baseQuery, matchesFilters, SEARCH_PAGE_SIZE, type PostSearchFilters, type SearchRow } from "@/lib/posts/search-posts";

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
  latestPostAt: string;
  latestComment: string | null;
  coverPath: string | null;
  coverMediaType: "photo" | "video" | null;
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
        latestPostAt: row.created_at,
        latestComment: firstLine(row.comment),
        coverPath: media?.storage_url ?? null,
        coverMediaType: media ? (media.media_type === "video" ? "video" : "photo") : null,
      };
      bySpot.set(spot.id, agg);
    }
    agg.postCount += 1;
    if (typeof row.rating === "number") {
      agg.ratingSum += row.rating;
      agg.ratingCount += 1;
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
  limit: number = SEARCH_PAGE_SIZE
): Promise<SpotCardPage> {
  const blockedIds = await getBlockedUserIds(admin, viewerId);
  const { data, error } = await applyFilters(baseQuery(admin, "newest"), filters, blockedIds).limit(SPOT_SEARCH_FETCH_CAP);
  if (error) throw error;
  const rows = ((data ?? []) as unknown as SearchRow[]).filter((row) => matchesFilters({ ...row, spot: row.spots }, filters));

  const sorted = sortSpotCards(aggregateSpotCards(rows), sort);
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

async function findSavedSpotIds(admin: SupabaseClient, viewerId: string, spotIds: string[]): Promise<Set<string>> {
  if (spotIds.length === 0) return new Set();
  const { data, error } = await admin.from("wishlist").select("spot_id").eq("user_id", viewerId).in("spot_id", spotIds);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.spot_id as string));
}

