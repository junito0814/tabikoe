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
  parsePostSort,
  POST_CARD_SELECT,
  POST_CARD_SPOT_EMBED,
  sortPostCards,
  type PostCardPage,
  type PostCardRow,
  type PostSort,
} from "@/lib/posts/post-cards";
import { todayInJst } from "./constants";
import { haversineMeters } from "@/lib/geo/walk-minutes";

/**
 * F-MP-04 Task1 / post-timeline Task1（v3.0）: 投稿検索・絞り込み（行き先のタイムライン）
 * 出典: docs/tasks/map-search/post-filter/01-post-filter-handler.md
 *       docs/tasks/map-search/post-timeline/01-search-api-destination.md
 *       要件定義書 v3.0 3.4.2
 *
 * 【初心者向け】このファイルは 3 段構成。
 *   1. 選択肢の定数（距離・費用レンジ・期間）と、URL クエリ → 条件（parsePostSearchParams）。純粋関数で単体テストしやすい
 *   2. 条件 → Supabase のクエリ（searchPostCards）。距離は「まず矩形で DB を絞り、次に Haversine（球面距離）で円判定」の 2 段階
 *   3. 取れた行を PostCardData に整形（post-cards.ts の buildPostCards を再利用。徒歩分・まだあった報告も付く）
 * v3.0 の「行き先」は 3 通り: 都道府県（spots.prefecture 一致）／駅・市区町村（座標から半径 5km）／スポット（スポット別）。
 * ブロック中のユーザーの投稿は getBlockedUserIds で除外する。
 */

/** 駅・市区町村で検索したときの周辺半径（m）。要件定義書 v3.0 3.4.2 */
export const DESTINATION_RADIUS_METERS = 5000;

/** 期間（訪問日）の選択肢 */
export const PERIOD_OPTIONS = ["this_month", "last_month", "custom"] as const;
export type PeriodOption = (typeof PERIOD_OPTIONS)[number];
export const PERIOD_LABELS: Record<PeriodOption, string> = {
  this_month: "今月",
  last_month: "先月",
  custom: "日付指定",
};

/** 行き先（3.4.2「検索の判定」） */
export type SearchDestination =
  | { kind: "prefecture"; name: string }
  | { kind: "nearby"; center: { lat: number; lng: number }; label: string | null }
  | { kind: "spot"; spotId: string };

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
  /** 距離の基準（地図の中心／駅・スポット・現在地） */
  center: { lat: number; lng: number } | null;
  costRange: CostRange | null;
  duration: PostDuration | null;
  /** v3.0: 行き先。null は条件なし（新着順の全件） */
  destination?: SearchDestination | null;
  /** v3.0: 訪問日の範囲（YYYY-MM-DD、両端を含む） */
  visitFrom?: string | null;
  visitTo?: string | null;
  sort?: PostSort;
  /** v3.0: 閲覧者の現在地（徒歩分の計算用。絞り込みには使わない） */
  viewer?: { lat: number; lng: number } | null;
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

  // v3.0: 行き先
  const pref = searchParams.get("pref")?.trim() ?? "";
  const spot = searchParams.get("spot")?.trim() ?? "";
  // 優先順: スポット別 > 都道府県 > 座標（駅・市区町村・現在地の周辺 5km）
  let destination: SearchDestination | null = null;
  if (spot) destination = { kind: "spot", spotId: spot };
  else if (pref) destination = { kind: "prefecture", name: pref };
  else if (center) destination = { kind: "nearby", center, label: keyword || null };

  // v3.0: 期間（訪問日）
  const { visitFrom, visitTo } = parsePeriod(searchParams);

  // v3.0: 閲覧者の現在地（徒歩分）
  const vlat = Number(searchParams.get("vlat"));
  const vlng = Number(searchParams.get("vlng"));
  const viewer = searchParams.has("vlat") && searchParams.has("vlng") && Number.isFinite(vlat) && Number.isFinite(vlng) ? { lat: vlat, lng: vlng } : null;

  return {
    // v3.0: 座標付きの q は「大阪駅」などの表示ラベルであって、スポット名の絞り込みではない
    keyword: keyword.length > 0 && destination?.kind !== "nearby" ? keyword : null,
    categories: Array.from(new Set(categories)),
    // 距離は基準座標が無ければ適用できない
    distanceMeters: center ? distanceMeters : null,
    center,
    costRange,
    duration,
    destination,
    visitFrom,
    visitTo,
    sort: parsePostSort(searchParams.get("sort")),
    viewer,
  };
}

/** 期間の選択肢 → 訪問日の範囲（JST）。単体テストの対象 */
export function parsePeriod(searchParams: URLSearchParams, today: string = todayInJst()): { visitFrom: string | null; visitTo: string | null } {
  const period = searchParams.get("period") ?? "";
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (period === "this_month") {
    return { visitFrom: `${y}-${pad(m)}-01`, visitTo: `${y}-${pad(m)}-${pad(lastDay(y, m))}` };
  }
  if (period === "last_month") {
    const ly = m === 1 ? y - 1 : y;
    const lm = m === 1 ? 12 : m - 1;
    return { visitFrom: `${ly}-${pad(lm)}-01`, visitTo: `${ly}-${pad(lm)}-${pad(lastDay(ly, lm))}` };
  }
  if (period === "custom") {
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";
    const valid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
    return { visitFrom: valid(from) ? from : null, visitTo: valid(to) ? to : null };
  }
  return { visitFrom: null, visitTo: null };
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

export { haversineMeters };

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
    visit_date?: string | null;
    spot: { name: string; lat: number; lng: number; prefecture?: string | null; id?: string };
  },
  filters: PostSearchFilters
): boolean {
  if (post.visibility !== "public") return false;
  // v3.0: 行き先
  const destination = filters.destination ?? null;
  if (destination?.kind === "prefecture" && post.spot.prefecture !== destination.name) return false;
  if (destination?.kind === "spot" && post.spot.id !== undefined && post.spot.id !== destination.spotId) return false;
  if (destination?.kind === "nearby" && haversineMeters(destination.center, post.spot) > DESTINATION_RADIUS_METERS) return false;
  // v3.0: 期間（訪問日）
  if (filters.visitFrom && (!post.visit_date || post.visit_date < filters.visitFrom)) return false;
  if (filters.visitTo && (!post.visit_date || post.visit_date > filters.visitTo)) return false;
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

export interface SearchRow extends PostCardRow {
  visibility: string;
  spots: { id: string; name: string; lat: number; lng: number; source: string; prefecture: string | null };
}

/** いいね順は集計列が無いため、まとめて取ってから並べる。その上限 */
const LIKES_SORT_FETCH_CAP = 500;

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
  const sort: PostSort = filters.sort ?? "newest";
  // いいね順は DB で並べられないため、上限まで取ってから並べて切り出す
  if (sort === "likes") {
    return searchByLikes(admin, viewerId, filters, offset, limit, blockedIds);
  }

  const collected: SearchRow[] = [];
  let cursor = offset;
  let exhausted = false;

  for (let round = 0; round < MAX_FETCH_ROUNDS && collected.length < limit && !exhausted; round++) {
    const query = applyFilters(baseQuery(admin, sort), filters, blockedIds).range(cursor, cursor + limit - 1);

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

  const posts = await buildPostCards(admin, viewerId, collected, { viewer: filters.viewer ?? null });
  return { posts, nextOffset: exhausted ? null : cursor };
}

// spots は POST_CARD_SELECT の spots(...) を inner join に置き換えて1回だけ埋め込む
// （2回埋め込むと PostgREST が "specified more than once" で失敗する。#252）
export function baseQuery(admin: SupabaseClient, sort: PostSort) {
  let query = admin
    .from("posts")
    .select(`${POST_CARD_SELECT.replace(POST_CARD_SPOT_EMBED, "spots!inner(id, name, lat, lng, source, prefecture)")}, visibility`)
    .eq("visibility", "public")
    // v3.0: 下書きは公開一覧に出さない
    .eq("status", "published")
    // F-AD-05: 非公開化された投稿・スポットは除く
    .is("hidden_at", null)
    .is("spots.hidden_at", null);
  if (sort === "rating") {
    query = query.order("rating", { ascending: false, nullsFirst: false });
  }
  return query.order("created_at", { ascending: false });
}

/** 条件を where に載せる（距離・行き先の円判定は矩形で事前に絞り、正確な判定は matchesFilters） */
export function applyFilters<Q extends ReturnType<typeof baseQuery>>(query: Q, filters: PostSearchFilters, blockedIds: string[]): Q {
  if (blockedIds.length > 0) {
    query = query.not("user_id", "in", `(${blockedIds.join(",")})`) as Q;
  }
  const destination = filters.destination ?? null;
  if (destination?.kind === "prefecture") {
    query = query.eq("spots.prefecture", destination.name) as Q;
  } else if (destination?.kind === "spot") {
    query = query.eq("spot_id", destination.spotId) as Q;
  } else if (destination?.kind === "nearby") {
    const box = boundsAround(destination.center, DESTINATION_RADIUS_METERS);
    query = query.gte("spots.lat", box.south).lte("spots.lat", box.north).gte("spots.lng", box.west).lte("spots.lng", box.east) as Q;
  }
  if (filters.keyword) {
    const escaped = filters.keyword.replace(/[\\%_]/g, (char) => `\\${char}`);
    query = query.ilike("spots.name", `%${escaped}%`) as Q;
  }
  if (filters.categories.length > 0) {
    query = query.in("category", filters.categories) as Q;
  }
  if (filters.duration) {
    query = query.eq("duration", filters.duration) as Q;
  }
  if (filters.costRange) {
    const { min, max } = costRangeBounds(filters.costRange);
    query = query.not("cost", "is", null).gte("cost", min) as Q;
    if (max !== null) query = query.lte("cost", max) as Q;
  }
  if (filters.visitFrom) query = query.gte("visit_date", filters.visitFrom) as Q;
  if (filters.visitTo) query = query.lte("visit_date", filters.visitTo) as Q;
  if (filters.distanceMeters && filters.center) {
    const box = boundsAround(filters.center, filters.distanceMeters);
    query = query.gte("spots.lat", box.south).lte("spots.lat", box.north).gte("spots.lng", box.west).lte("spots.lng", box.east) as Q;
  }
  return query;
}

async function searchByLikes(
  admin: SupabaseClient,
  viewerId: string,
  filters: PostSearchFilters,
  offset: number,
  limit: number,
  blockedIds: string[]
): Promise<PostCardPage> {
  const { data, error } = await applyFilters(baseQuery(admin, "newest"), filters, blockedIds).limit(LIKES_SORT_FETCH_CAP);
  if (error) throw error;
  const rows = ((data ?? []) as unknown as SearchRow[]).filter((row) => matchesFilters({ ...row, spot: row.spots }, filters));
  const cards = sortPostCards(await buildPostCards(admin, viewerId, rows, { viewer: filters.viewer ?? null }), "likes");
  const page = cards.slice(offset, offset + limit);
  return { posts: page, nextOffset: offset + limit < cards.length ? offset + limit : null };
}
