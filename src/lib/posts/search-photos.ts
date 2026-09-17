import type { SupabaseClient } from "@supabase/supabase-js";
import { getBlockedUserIds } from "@/lib/blocks/get-blocked-user-ids";
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
}

export interface SpotPostMediaRow {
  id: string;
  created_at: string;
  visibility: string;
  spots: { name: string } | { name: string }[] | null;
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
): { key: string; postId: string; path: string; videoUrl: string | null; mediaType: "photo" | "video"; postedAt: string; spotName: string }[] {
  return rows
    .filter((row) => row.visibility === "public")
    .flatMap((row) => {
      const spotName = (Array.isArray(row.spots) ? row.spots[0] : row.spots)?.name ?? "";
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
                },
              ]
            : []
        );
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
  limit: number = PHOTOS_PAGE_SIZE
): Promise<SpotMediaPage> {
  const blockedIds = await getBlockedUserIds(admin, viewerId);
  const sort: PostSort = filters.sort ?? "newest";
  const { data, error } = await applyFilters(baseQuery(admin, sort), filters, blockedIds).limit(POSTS_FETCH_CAP);
  if (error) throw error;

  const rows = ((data ?? []) as unknown as SearchRow[]).filter((row) => matchesFilters({ ...row, spot: row.spots }, filters));
  // いいね順は DB で並べられないので、ここで並べ直す（新着順・評価順も同じ関数で揃える）
  const ordered = sortPostCards(
    rows.map((row) => ({ row, createdAt: row.created_at, rating: row.rating, likeCount: row.likes?.[0]?.count ?? 0 })),
    sort
  ).map((item) => item.row);

  const merged = mergeMedia(ordered as unknown as SpotPostMediaRow[]);
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
      },
    ];
  });

  return { items, nextOffset: offset + limit < merged.length ? offset + limit : null };
}
