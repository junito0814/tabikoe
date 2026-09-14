import type { SupabaseClient } from "@supabase/supabase-js";
import { getBlockedUserIds } from "@/lib/blocks/get-blocked-user-ids";
import {
  POST_CATEGORIES,
  POST_DURATIONS,
  type PostCategory,
  type PostDuration,
} from "@/lib/posts/constants";
import {
  buildPostCards,
  POST_CARD_SELECT,
  type PostCardPage,
  type PostCardRow,
} from "@/lib/posts/post-cards";

/**
 * F-MP-04 Task1: 投稿検索・絞り込み
 * 出典: docs/tasks/map-search/post-filter/01-post-filter-handler.md
 *       要件定義書3.4.4
 */

/** 距離の選択肢（m）。地図の中心座標を基準にする */
export const DISTANCE_OPTIONS = [500, 1000, 3000, 5000] as const;
export type DistanceOption = (typeof DISTANCE_OPTIONS)[number];

/** 費用のレンジ（1人あたり、円） */
export const COST_RANGES = ["1000", "3000", "5000", "over"] as const;
export type CostRange = (typeof COST_RANGES)[number];

export const COST_RANGE_LABELS: Record<CostRange, string> = {
  "1000": "〜1,000円",
  "3000": "〜3,000円",
  "5000": "〜5,000円",
  over: "5,000円〜",
};

export const DISTANCE_LABELS: Record<DistanceOption, string> = {
  500: "500m以内",
  1000: "1km以内",
  3000: "3km以内",
  5000: "5km以内",
};

export const SEARCH_PAGE_SIZE = 20;

export interface PostSearchFilters {
  /** スポット名の部分一致 */
  keyword: string | null;
  categories: PostCategory[];
  distanceMeters: DistanceOption | null;
  /** 距離の基準（地図の中心） */
  center: { lat: number; lng: number } | null;
  costRange: CostRange | null;
  duration: PostDuration | null;
}

/** クエリ文字列 → 絞り込み条件。不正な値は無視する（単体テストの対象） */
export function parsePostSearchParams(searchParams: URLSearchParams): PostSearchFilters {
  const keyword = searchParams.get("q")?.trim() ?? "";
  const categories = (searchParams.get("categories") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is PostCategory =>
      (POST_CATEGORIES as readonly string[]).includes(value)
    );
  const distanceRaw = Number(searchParams.get("distance"));
  const distanceMeters = (DISTANCE_OPTIONS as readonly number[]).includes(distanceRaw)
    ? (distanceRaw as DistanceOption)
    : null;
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const center =
    searchParams.has("lat") && searchParams.has("lng") && Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : null;
  const costRaw = searchParams.get("cost") ?? "";
  const costRange = (COST_RANGES as readonly string[]).includes(costRaw) ? (costRaw as CostRange) : null;
  const durationRaw = searchParams.get("duration") ?? "";
  const duration = (POST_DURATIONS as readonly string[]).includes(durationRaw)
    ? (durationRaw as PostDuration)
    : null;

  return {
    keyword: keyword.length > 0 ? keyword : null,
    categories: Array.from(new Set(categories)),
    // 距離は基準座標が無ければ適用できない
    distanceMeters: center ? distanceMeters : null,
    center,
    costRange,
    duration,
  };
}

/** 費用レンジの上下限（円）。上限は含む */
export function costRangeBounds(range: CostRange): { min: number; max: number | null } {
  switch (range) {
    case "1000":
      return { min: 0, max: 1000 };
    case "3000":
      return { min: 0, max: 3000 };
    case "5000":
      return { min: 0, max: 5000 };
    case "over":
      return { min: 5000, max: null };
  }
}

/** 費用未入力（null）の投稿は、費用で絞り込む時は除外する（3.4.4） */
export function matchesCostRange(cost: number | null, range: CostRange): boolean {
  if (cost === null) return false;
  const { min, max } = costRangeBounds(range);
  return cost >= min && (max === null || cost <= max);
}

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** 半径 radius(m) を含む矩形。DB 側の事前絞り込みに使い、正確な判定は haversine で行う */
export function boundsAround(center: { lat: number; lng: number }, radiusMeters: number) {
  const latDelta = radiusMeters / 111320;
  const lngDelta = radiusMeters / (111320 * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.000001));
  return {
    north: center.lat + latDelta,
    south: center.lat - latDelta,
    east: center.lng + lngDelta,
    west: center.lng - lngDelta,
  };
}

/**
 * 取得済みの行に対して、DB では表現しにくい条件（距離の円判定）を適用する。単体テストの対象。
 * 他の条件（キーワード・カテゴリ・費用・滞在時間・公開設定）は DB 側の where に載せるが、
 * 同じ判定をここでも持ち、条件の組み合わせが純粋関数として検証できるようにしている。
 */
export function matchesFilters(
  post: {
    visibility: string;
    category: string;
    cost: number | null;
    duration: string | null;
    spot: { name: string; lat: number; lng: number };
  },
  filters: PostSearchFilters
): boolean {
  if (post.visibility !== "public") return false;
  if (filters.keyword && !post.spot.name.toLowerCase().includes(filters.keyword.toLowerCase())) {
    return false;
  }
  if (filters.categories.length > 0 && !filters.categories.includes(post.category as PostCategory)) {
    return false;
  }
  if (filters.costRange && !matchesCostRange(post.cost, filters.costRange)) return false;
  if (filters.duration && post.duration !== filters.duration) return false;
  if (filters.distanceMeters && filters.center) {
    if (haversineMeters(filters.center, post.spot) > filters.distanceMeters) return false;
  }
  return true;
}

interface SearchRow extends PostCardRow {
  visibility: string;
  spots: { name: string; lat: number; lng: number };
}

/** ページを埋めるために DB を読み足す回数の上限（矩形→円で落ちる分の補填） */
const MAX_FETCH_ROUNDS = 5;

/**
 * 公開投稿を条件で絞り込み、新着順に1ページ（20件）返す。
 * `offset` は DB 上の行オフセット。距離の円判定で落ちた分は次の行を読み足して補う。
 */
export async function searchPostCards(
  admin: SupabaseClient,
  viewerId: string,
  filters: PostSearchFilters,
  offset: number,
  limit: number = SEARCH_PAGE_SIZE
): Promise<PostCardPage> {
  const blockedIds = await getBlockedUserIds(admin, viewerId);
  const collected: SearchRow[] = [];
  let cursor = offset;
  let exhausted = false;

  for (let round = 0; round < MAX_FETCH_ROUNDS && collected.length < limit && !exhausted; round++) {
    // spots は POST_CARD_SELECT の `spots(name)` を inner join＋座標付きに置き換えて1回だけ埋め込む
    // （2回埋め込むと PostgREST が "specified more than once" で失敗する。#252）
    let query = admin
      .from("posts")
      .select(`${POST_CARD_SELECT.replace("spots(name)", "spots!inner(name, lat, lng)")}, visibility`)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .range(cursor, cursor + limit - 1);

    if (blockedIds.length > 0) {
      query = query.not("user_id", "in", `(${blockedIds.join(",")})`);
    }
    if (filters.keyword) {
      const escaped = filters.keyword.replace(/[\\%_]/g, (char) => `\\${char}`);
      query = query.ilike("spots.name", `%${escaped}%`);
    }
    if (filters.categories.length > 0) {
      query = query.in("category", filters.categories);
    }
    if (filters.duration) {
      query = query.eq("duration", filters.duration);
    }
    if (filters.costRange) {
      const { min, max } = costRangeBounds(filters.costRange);
      query = query.not("cost", "is", null).gte("cost", min);
      if (max !== null) query = query.lte("cost", max);
    }
    if (filters.distanceMeters && filters.center) {
      const box = boundsAround(filters.center, filters.distanceMeters);
      query = query
        .gte("spots.lat", box.south)
        .lte("spots.lat", box.north)
        .gte("spots.lng", box.west)
        .lte("spots.lng", box.east);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as SearchRow[];
    cursor += rows.length;
    exhausted = rows.length < limit;

    for (const row of rows) {
      if (matchesFilters({ ...row, spot: row.spots }, filters)) {
        collected.push(row);
        if (collected.length >= limit) break;
      }
    }
  }

  const posts = await buildPostCards(admin, viewerId, collected);
  return { posts, nextOffset: exhausted ? null : cursor };
}
