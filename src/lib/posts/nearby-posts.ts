import type { SupabaseClient } from "@supabase/supabase-js";
import { getBlockedUserIds } from "@/lib/blocks/get-blocked-user-ids";
import { haversineMeters, walkMinutes } from "@/lib/geo/walk-minutes";
import { createPostPhotoUrls } from "@/lib/posts/signed-url";
import { boundsAround } from "@/lib/posts/search-posts";

/**
 * explore-mode Task1: 近くの投稿 API のロジック
 * 出典: docs/tasks/browsing/explore-mode/01-nearby-posts-api.md
 *       要件定義書 v3.0 3.4.5（探すモード。徒歩圏 500m／1km／3km、既定 1km、近い順に最大 20 件）
 *
 * 【初心者向け】「近くの声」のカードに必要な最小限（スポット名・感想の冒頭・代表写真・距離・徒歩分）だけを返す。
 * 距離の絞り込みは post-timeline と同じ 2 段階（矩形で DB を絞る → Haversine で円判定）。
 * 並び順は「近い順」。同じスポットに複数の投稿があっても、それぞれ別のカードにする（声を見せる画面なので）。
 */
export const NEARBY_RADIUS_OPTIONS = [500, 1000, 3000] as const;
export type NearbyRadius = (typeof NEARBY_RADIUS_OPTIONS)[number];
export const DEFAULT_NEARBY_RADIUS: NearbyRadius = 1000;
export const NEARBY_RADIUS_LABELS: Record<NearbyRadius, string> = { 500: "500m", 1000: "1km", 3000: "3km" };
export const NEARBY_POSTS_LIMIT = 20;
/** 円判定の前に DB から取る上限（矩形の中には円の外も含まれるため多めに） */
const NEARBY_FETCH_CAP = 200;

export function parseNearbyRadius(value: string | null): NearbyRadius {
  const number = Number(value);
  return (NEARBY_RADIUS_OPTIONS as readonly number[]).includes(number) ? (number as NearbyRadius) : DEFAULT_NEARBY_RADIUS;
}

export interface NearbyPost {
  id: string;
  spotId: string;
  spotName: string;
  commentExcerpt: string | null;
  thumbnailUrl: string | null;
  lat: number;
  lng: number;
  distanceMeters: number;
  walkMinutes: number;
}

export interface NearbyPostRow {
  id: string;
  spot_id: string;
  comment: string | null;
  spots: { id: string; name: string; lat: number; lng: number } | { id: string; name: string; lat: number; lng: number }[] | null;
  post_photos: { storage_url: string | null; display_order: number; hidden_at?: string | null }[];
}

const EXCERPT_LENGTH = 40;

/** 半径内を近い順に最大 limit 件（単体テストの対象。署名 URL は後で付ける） */
export function selectNearbyPosts(
  rows: NearbyPostRow[],
  center: { lat: number; lng: number },
  radiusMeters: number,
  limit: number = NEARBY_POSTS_LIMIT
): (Omit<NearbyPost, "thumbnailUrl"> & { thumbnailPath: string | null })[] {
  return rows
    .flatMap((row) => {
      const spot = Array.isArray(row.spots) ? row.spots[0] : row.spots;
      if (!spot) return [];
      const distance = haversineMeters(center, spot);
      if (distance > radiusMeters) return [];
      const photo = [...row.post_photos].filter((p) => !p.hidden_at).sort((a, b) => a.display_order - b.display_order)[0];
      return [
        {
          id: row.id,
          spotId: spot.id,
          spotName: spot.name,
          commentExcerpt: row.comment
            ? Array.from(row.comment).slice(0, EXCERPT_LENGTH).join("") + (Array.from(row.comment).length > EXCERPT_LENGTH ? "…" : "")
            : null,
          thumbnailPath: photo?.storage_url ?? null,
          lat: spot.lat,
          lng: spot.lng,
          distanceMeters: Math.round(distance),
          walkMinutes: walkMinutes(distance),
        },
      ];
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}

export async function getNearbyPosts(
  admin: SupabaseClient,
  viewerId: string,
  center: { lat: number; lng: number },
  radiusMeters: NearbyRadius
): Promise<NearbyPost[]> {
  const blockedIds = await getBlockedUserIds(admin, viewerId);
  const box = boundsAround(center, radiusMeters);
  let query = admin
    .from("posts")
    .select("id, spot_id, comment, spots!inner(id, name, lat, lng), post_photos(storage_url, display_order, hidden_at)")
    .eq("visibility", "public")
    .eq("status", "published")
    .is("hidden_at", null)
    .is("spots.hidden_at", null)
    .gte("spots.lat", box.south)
    .lte("spots.lat", box.north)
    .gte("spots.lng", box.west)
    .lte("spots.lng", box.east)
    .order("created_at", { ascending: false })
    .limit(NEARBY_FETCH_CAP);
  if (blockedIds.length > 0) query = query.not("user_id", "in", `(${blockedIds.join(",")})`);
  const { data, error } = await query;
  if (error) throw error;

  const selected = selectNearbyPosts((data ?? []) as unknown as NearbyPostRow[], center, radiusMeters);
  const signed = await createPostPhotoUrls(admin, selected.flatMap((post) => (post.thumbnailPath ? [post.thumbnailPath] : [])));
  return selected.map(({ thumbnailPath, ...post }) => ({ ...post, thumbnailUrl: thumbnailPath ? (signed.get(thumbnailPath) ?? null) : null }));
}
