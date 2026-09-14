import type { SupabaseClient } from "@supabase/supabase-js";
import { getBlockedUserIds } from "@/lib/blocks/get-blocked-user-ids";
import { createPostPhotoUrls } from "@/lib/posts/signed-url";

/**
 * F-MP-05 Task1: スポット写真一覧取得
 * 出典: docs/tasks/map-search/spot-photo-gallery/01-spot-photos-handler.md
 *       要件定義書3.4.5
 */

/** 1回に返す点数 */
export const SPOT_PHOTOS_PAGE_SIZE = 40;

/** 1スポットあたり読み込む投稿の上限（横断的に集めてから並べるための安全弁） */
const SPOT_POSTS_FETCH_CAP = 500;

export interface SpotMediaItem {
  id: string;
  postId: string;
  mediaType: "photo" | "video";
  /** 署名付きURL */
  thumbnailUrl: string;
  videoUrl: string | null;
  alt: string;
  /** 元投稿の投稿日時（新着順の基準） */
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
 * 複数投稿の写真・動画を1つの列に統合し、投稿日時が新しい順（同一投稿内は display_order 順）に並べる。
 * 非公開投稿（`includePrivate` が無い場合）・保存パスの無い行は落とす。単体テストの対象。
 * アルバム写真一覧（SC-21）はメンバー限定のため非公開投稿も含める（3.6.3）。
 */
export function mergeSpotMedia(
  rows: SpotPostMediaRow[],
  options: { includePrivate?: boolean } = {}
): { key: string; postId: string; path: string; videoUrl: string | null; mediaType: "photo" | "video"; postedAt: string; spotName: string }[] {
  return rows
    .filter((row) => options.includePrivate || row.visibility === "public")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
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

export interface SpotMediaPage {
  items: SpotMediaItem[];
  nextOffset: number | null;
}

/** 指定スポットの公開投稿の写真・動画を新着順に1ページ（40点）返す */
export async function getSpotMediaPage(
  admin: SupabaseClient,
  viewerId: string,
  spotId: string,
  offset: number,
  limit: number = SPOT_PHOTOS_PAGE_SIZE
): Promise<SpotMediaPage> {
  const blockedIds = await getBlockedUserIds(admin, viewerId);

  let query = admin
    .from("posts")
    .select("id, created_at, visibility, spots(name), post_photos(id, storage_url, video_url, media_type, display_order, hidden_at)")
    .eq("spot_id", spotId)
    .eq("visibility", "public")
    // F-AD-05: 非公開化された投稿は除く（写真単位の非公開化は mergeSpotMedia で落とす）
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(SPOT_POSTS_FETCH_CAP);
  if (blockedIds.length > 0) {
    query = query.not("user_id", "in", `(${blockedIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const merged = mergeSpotMedia((data ?? []) as unknown as SpotPostMediaRow[]);
  return buildMediaPage(admin, merged, offset, limit);
}

/**
 * 統合済みの列から1ページ分を切り出し、署名付きURLを付けて返す。
 * スポット写真一覧（SC-13）とアルバム写真一覧（SC-21）で共用。
 */
export async function buildMediaPage(
  admin: SupabaseClient,
  merged: ReturnType<typeof mergeSpotMedia>,
  offset: number,
  limit: number
): Promise<SpotMediaPage> {
  const page = merged.slice(offset, offset + limit);
  // 動画本体も非公開バケットにあるため、サムネイルと合わせて署名する
  const signedUrls = await createPostPhotoUrls(
    admin,
    Array.from(new Set(page.flatMap((item) => (item.videoUrl ? [item.path, item.videoUrl] : [item.path]))))
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
