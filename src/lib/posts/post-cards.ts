import type { SupabaseClient } from "@supabase/supabase-js";
import { getBlockedUserIds } from "@/lib/blocks/get-blocked-user-ids";
import { createPostPhotoUrls } from "@/lib/posts/signed-url";
import { DEFAULT_AVATAR_URL } from "@/lib/users/constants";

/**
 * F-MP-03 Task1: スポット別投稿一覧
 * 出典: docs/tasks/map-search/pin-interaction/01-spot-posts-handler.md
 *
 * 投稿カード一覧（SC-04）に載せる1件分。スポット別一覧（F-MP-03）と検索・絞り込み（F-MP-04）で共通。
 *
 * 【初心者向け】DB の行（snake_case、埋め込みの配列）をそのまま画面に渡さず、画面が使いやすい形（camelCase、
 * サムネイル URL は署名付きに変換済み、いいね数は数値）に整形するのがこのファイルの役割。
 * `POST_CARD_SELECT` は PostgREST の埋め込み記法で、`spots(name)` は結合、`likes(count)` は件数集計。
 */
export interface PostCardData {
  id: string;
  spotId: string;
  spotName: string;
  category: string;
  visitDate: string | null;
  duration: string | null;
  cost: number | null;
  rating: number | null;
  /** 感想の冒頭（カードに収まる長さ） */
  commentExcerpt: string | null;
  createdAt: string;
  author: { id: string; displayName: string; avatarUrl: string };
  /** 代表画像（1点目）。署名付きURL。取れなければ null */
  thumbnailUrl: string | null;
  thumbnailMediaType: "photo" | "video" | null;
  mediaCount: number;
  likeCount: number;
  commentCount: number;
  /** 閲覧者がいいね済みか（F-VW-02 Task3 のボタン初期状態） */
  viewerHasLiked: boolean;
}

export const POST_SORTS = ["newest", "rating", "likes"] as const;
export type PostSort = (typeof POST_SORTS)[number];

export const POST_SORT_LABELS: Record<PostSort, string> = {
  newest: "新着順",
  rating: "評価順",
  likes: "いいね順",
};

/** 既定は新着順（3.4.3） */
export function parsePostSort(value: string | null): PostSort {
  return (POST_SORTS as readonly string[]).includes(value ?? "") ? (value as PostSort) : "newest";
}

const EXCERPT_LENGTH = 80;

/** DB から取る列。埋め込みの件数集計（likes/comments）は PostgREST の count 埋め込み */
export const POST_CARD_SELECT =
  "id, spot_id, user_id, category, visit_date, duration, cost, rating, comment, created_at, " +
  "spots(name), users(display_name, avatar_url), " +
  "post_photos(storage_url, media_type, display_order), likes(count), comments(count)";

export interface PostCardRow {
  id: string;
  spot_id: string;
  user_id: string;
  category: string;
  visit_date: string | null;
  duration: string | null;
  cost: number | null;
  rating: number | null;
  comment: string | null;
  created_at: string;
  spots: { name: string } | { name: string }[] | null;
  users: { display_name: string | null; avatar_url: string | null } | { display_name: string | null; avatar_url: string | null }[] | null;
  post_photos: { storage_url: string | null; media_type: string; display_order: number }[];
  likes: { count: number }[];
  comments: { count: number }[];
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** 代表メディア（display_order が最小のもの）を返す */
export function representativeMedia(
  photos: PostCardRow["post_photos"]
): { storage_url: string | null; media_type: string } | null {
  return [...photos].sort((a, b) => a.display_order - b.display_order)[0] ?? null;
}

export function toPostCard(
  row: PostCardRow,
  signedUrls: Map<string, string>,
  likedPostIds: ReadonlySet<string> = new Set()
): PostCardData {
  const spot = one(row.spots);
  const user = one(row.users);
  const representative = representativeMedia(row.post_photos);
  const path = representative?.storage_url ?? null;
  return {
    id: row.id,
    spotId: row.spot_id,
    spotName: spot?.name ?? "",
    category: row.category,
    visitDate: row.visit_date,
    duration: row.duration,
    cost: row.cost,
    rating: row.rating,
    commentExcerpt: row.comment
      ? Array.from(row.comment).slice(0, EXCERPT_LENGTH).join("") +
        (Array.from(row.comment).length > EXCERPT_LENGTH ? "…" : "")
      : null,
    createdAt: row.created_at,
    author: {
      id: row.user_id,
      displayName: user?.display_name ?? "ユーザー",
      avatarUrl: user?.avatar_url ?? DEFAULT_AVATAR_URL,
    },
    thumbnailUrl: path ? (signedUrls.get(path) ?? null) : null,
    thumbnailMediaType:
      representative?.media_type === "video" ? "video" : representative ? "photo" : null,
    mediaCount: row.post_photos.length,
    likeCount: row.likes?.[0]?.count ?? 0,
    commentCount: row.comments?.[0]?.count ?? 0,
    viewerHasLiked: likedPostIds.has(row.id),
  };
}

/**
 * 並び替え（3.4.3）。同順位は新しい順で安定させる。単体テストの対象。
 * - newest: 投稿日時が新しい順
 * - rating: 星評価が高い順（未評価は末尾）
 * - likes : いいね数が多い順
 */
export function sortPostCards<T extends Pick<PostCardData, "createdAt" | "rating" | "likeCount">>(
  cards: T[],
  sort: PostSort
): T[] {
  const byNewest = (a: T, b: T) => b.createdAt.localeCompare(a.createdAt);
  return [...cards].sort((a, b) => {
    if (sort === "rating") {
      const diff = (b.rating ?? 0) - (a.rating ?? 0);
      if (diff !== 0) return diff;
    } else if (sort === "likes") {
      const diff = b.likeCount - a.likeCount;
      if (diff !== 0) return diff;
    }
    return byNewest(a, b);
  });
}

/** 一覧を署名付きURL付きのカードへ変換する（可視性の判定は呼び出し側が済ませていること） */
export async function buildPostCards(
  admin: SupabaseClient,
  viewerId: string,
  rows: PostCardRow[]
): Promise<PostCardData[]> {
  const paths = rows.flatMap((row) => {
    const path = representativeMedia(row.post_photos)?.storage_url;
    return path ? [path] : [];
  });
  const [signedUrls, likedPostIds] = await Promise.all([
    createPostPhotoUrls(admin, Array.from(new Set(paths))),
    findLikedPostIds(admin, viewerId, rows.map((row) => row.id)),
  ]);
  return rows.map((row) => toPostCard(row, signedUrls, likedPostIds));
}

/** 閲覧者がいいね済みの投稿ID */
async function findLikedPostIds(
  admin: SupabaseClient,
  viewerId: string,
  postIds: string[]
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const { data, error } = await admin
    .from("likes")
    .select("post_id")
    .eq("user_id", viewerId)
    .in("post_id", postIds);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.post_id as string));
}

/** 1スポットあたりに読み込む投稿の上限。並び替えをサーバー側の集計に依存させないための安全弁 */
const SPOT_POSTS_FETCH_CAP = 500;

/** スポット別一覧のページサイズ */
export const SPOT_POSTS_PAGE_SIZE = 20;

export interface PostCardPage {
  posts: PostCardData[];
  nextOffset: number | null;
}

/**
 * 指定スポットの公開投稿を並び替えて1ページ分返す。
 * いいね数の集計で並べ替えるため DB の order には頼らず、スポット単位（上限500件）で取ってから並べる。
 * ブロック関係のユーザーの投稿は相互非表示（3.8.2）。
 */
export async function getSpotPostCards(
  admin: SupabaseClient,
  viewerId: string,
  spotId: string,
  sort: PostSort,
  offset: number,
  limit: number = SPOT_POSTS_PAGE_SIZE
): Promise<PostCardPage> {
  const blockedIds = await getBlockedUserIds(admin, viewerId);

  let query = admin
    .from("posts")
    .select(POST_CARD_SELECT)
    .eq("spot_id", spotId)
    .eq("visibility", "public")
    // v3.0: 下書きは公開一覧に出さない
    .eq("status", "published")
    // F-AD-05: 非公開化された投稿は除く
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(SPOT_POSTS_FETCH_CAP);
  if (blockedIds.length > 0) {
    query = query.not("user_id", "in", `(${blockedIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const cards = await buildPostCards(admin, viewerId, (data ?? []) as unknown as PostCardRow[]);
  const sorted = sortPostCards(cards, sort);
  const page = sorted.slice(offset, offset + limit);
  return {
    posts: page,
    nextOffset: offset + limit < sorted.length ? offset + limit : null,
  };
}
