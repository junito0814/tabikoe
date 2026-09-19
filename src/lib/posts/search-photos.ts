import type { SupabaseClient } from "@supabase/supabase-js";
import { getBlockedUserIds } from "@/lib/blocks/get-blocked-user-ids";
import { aggregateSpotCards, sortSpotCards, type SpotSort } from "@/lib/spots/search-spots";
import { createPostPhotoUrls } from "@/lib/posts/signed-url";
import { sortPostCards, type PostSort } from "@/lib/posts/post-cards";
import { applyFilters, baseQuery, matchesFilters, type PostSearchFilters, type SearchRow } from "@/lib/posts/search-posts";

/**
 * F-MP-05 Task1 / photo-view Task1（v3.0）: 写真・動画の一覧取得（検索条件つき）
 * 出典: docs/tasks/map-search/spot-photo-gallery/01-spot-photos-handler.md
 *       docs/tasks/map-search/photo-view/01-photos-api-search-params.md
 *       要件定義書 v3.0 3.4.2（「写真」切替。並び替えは投稿一覧と連動）
 *
 * 【初心者向け】投稿一覧（search-posts.ts）と同じ条件で投稿を取り、その写真・動画を 1 列に並べて 40 点ずつ返す。
 * 並び順は「投稿の順（新着順／評価順／いいね順）→ 同じ投稿の中では添付順」。
 * 写真単位で DB からページングするのは難しい（投稿の並び替えが先に必要）ので、投稿を上限 500 件まで取ってから
 * メモリ上で並べて切り出す（スポット別一覧のいいね順と同じ考え方）。
 */

/** 1回に返す点数 */
export const PHOTOS_PAGE_SIZE = 40;
/** 横断的に集めてから並べるための、投稿件数の上限 */
const POSTS_FETCH_CAP = 500;

export interface SpotMediaItem {
  id: string;
  postId: string;
  mediaType: "photo" | "video";
  /** 署名付きURL */
  thumbnailUrl: string;
  videoUrl: string | null;
  alt: string;
  /** 元投稿の投稿日時 */
  postedAt: string;
  /** v3.2（feedback-0919 Task3）: モーダルの情報バー用（スポット名・タビコエだけの場所・★・滞在・費用・投稿者・訪問日） */
  info: { spotName: string; isManualSpot: boolean; rating: number | null; duration: string | null; cost: number | null; authorName: string; visitDate: string | null };
}

export interface SpotPostMediaRow {
  id: string;
  created_at: string;
  visibility: string;
  spots: { name: string; source?: string } | { name: string; source?: string }[] | null;
  /** v3.2: 情報バー用（無くてもよい） */
  users?: { display_name: string | null; avatar_url?: string | null; is_deleted?: boolean } | { display_name: string | null; avatar_url?: string | null; is_deleted?: boolean }[] | null;
  rating?: number | null;
  duration?: string | null;
  cost?: number | null;
  visit_date?: string | null;
  post_photos: {
    id: string;
    storage_url: string | null;
    video_url: string | null;
    media_type: string;
    display_order: number;
    hidden_at?: string | null;
  }[];
}

/**
 * 並べ替え済みの投稿の写真・動画を 1 列に統合する（投稿の順はそのまま、同一投稿内は display_order 順）。
 * 非公開投稿・保存パスの無い行・非公開化された写真は落とす。単体テストの対象。
 */
export function mergeMedia(
  rows: SpotPostMediaRow[]
): { key: string; postId: string; path: string; videoUrl: string | null; mediaType: "photo" | "video"; postedAt: string; spotName: string; info: SpotMediaItem["info"] }[] {
  return rows
    .filter((row) => row.visibility === "public")
    .flatMap((row) => {
      const spot = Array.isArray(row.spots) ? row.spots[0] : row.spots;
      const spotName = spot?.name ?? "";
      const user = Array.isArray(row.users) ? row.users[0] : row.users;
      const info: SpotMediaItem["info"] = {
        spotName,
        isManualSpot: spot?.source === "manual",
        rating: row.rating ?? null,
        duration: row.duration ?? null,
        cost: row.cost ?? null,
        authorName: user?.is_deleted ? "退会済みユーザー" : (user?.display_name ?? "ユーザー"),
        visitDate: row.visit_date ?? null,
      };
      return [...row.post_photos]
        .sort((a, b) => a.display_order - b.display_order)
        .flatMap((photo) =>
          photo.storage_url && !photo.hidden_at
            ? [
                {
                  key: photo.id,
                  postId: row.id,
                  path: photo.storage_url,
                  videoUrl: photo.video_url,
                  mediaType: photo.media_type === "video" ? ("video" as const) : ("photo" as const),
                  postedAt: row.created_at,
                  spotName,
                  info,
                },
              ]
            : []
        );
    });
}

/** v3.1: 検索結果の写真タブで 1 スポットに出す枚数の上限 */
export const PHOTOS_PER_SPOT_CAP = 5;

/**
 * v3.1（mentoring-7 Task5）: スポットの順に、各スポットの新しい投稿から最大 `cap` 枚ずつ統合する（純粋関数）。
 * 【初心者向け】投稿をスポットごとに分け、スポットの並び（sortSpotCards）で並べ、各スポットの投稿を新着順にして
 * mergeMedia した先頭 cap 枚だけ残す。同じ投稿の写真は添付順にまとまる。
 */
export function mergeMediaBySpot(rows: SearchRow[], spotSort: SpotSort, cap: number): ReturnType<typeof mergeMedia> {
  const bySpot = new Map<string, SearchRow[]>();
  for (const row of rows) {
    const list = bySpot.get(row.spot_id) ?? [];
    list.push(row);
    bySpot.set(row.spot_id, list);
  }
  const spotOrder = sortSpotCards(aggregateSpotCards([...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))), spotSort);
  return spotOrder.flatMap((spot) => {
    const posts = [...(bySpot.get(spot.id) ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return mergeMedia(posts as unknown as SpotPostMediaRow[]).slice(0, cap);
  });
}

/** v1 互換: 新着順に並べてから統合する */
export function mergeSpotMedia(rows: SpotPostMediaRow[]) {
  return mergeMedia([...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)));
}

export interface SpotMediaPage {
  items: SpotMediaItem[];
  nextOffset: number | null;
}

/** 検索条件に合う公開投稿の写真・動画を、投稿一覧と同じ並び順で 1 ページ（40 点）返す */
export async function searchMediaPage(
  admin: SupabaseClient,
  viewerId: string,
  filters: PostSearchFilters,
  offset: number,
  limit: number = PHOTOS_PAGE_SIZE,
  /** v3.1: 検索結果（スポット単位）のときのスポットの並び。スポット別では使わない */
  spotSort: SpotSort | null = null
): Promise<SpotMediaPage> {
  const blockedIds = await getBlockedUserIds(admin, viewerId);
  const sort: PostSort = filters.sort ?? "newest";
  const { data, error } = await applyFilters(baseQuery(admin, sort), filters, blockedIds).limit(POSTS_FETCH_CAP);
  if (error) throw error;

  const rows = ((data ?? []) as unknown as SearchRow[]).filter((row) => matchesFilters({ ...row, spot: row.spots }, filters));

  let merged: ReturnType<typeof mergeMedia>;
  if (filters.destination?.kind !== "spot") {
    // v3.1（mentoring-7 Task5）: 検索結果（都道府県・駅）はスポットの順（新着順／評価順／投稿数順）に、
    // 1 スポットにつき新しい投稿から最大 5 枚（人気スポットの写真だけで埋まらないように）
    merged = mergeMediaBySpot(rows, spotSort ?? "newest", PHOTOS_PER_SPOT_CAP);
  } else {
    // スポット別: 投稿の順（新着順／評価順／いいね順）で全部。いいね順は DB で並べられないので、ここで並べ直す
    const ordered = sortPostCards(
      rows.map((row) => ({ row, createdAt: row.created_at, rating: row.rating, likeCount: row.likes?.[0]?.count ?? 0 })),
      sort
    ).map((item) => item.row);
    merged = mergeMedia(ordered as unknown as SpotPostMediaRow[]);
  }
  const page = merged.slice(offset, offset + limit);
  const signedUrls = await createPostPhotoUrls(
    admin,
    Array.from(new Set(page.flatMap((item) => [item.path, ...(item.videoUrl ? [item.videoUrl] : [])])))
  );

  const items: SpotMediaItem[] = page.flatMap((item, index) => {
    const url = signedUrls.get(item.path);
    if (!url) return [];
    return [
      {
        id: item.key,
        postId: item.postId,
        mediaType: item.mediaType,
        thumbnailUrl: url,
        videoUrl: item.videoUrl ? (signedUrls.get(item.videoUrl) ?? null) : null,
        alt: `${item.spotName}の${item.mediaType === "video" ? "動画" : "写真"} ${offset + index + 1}`,
        postedAt: item.postedAt,
        info: item.info,
      },
    ];
  });

  return { items, nextOffset: offset + limit < merged.length ? offset + limit : null };
}
