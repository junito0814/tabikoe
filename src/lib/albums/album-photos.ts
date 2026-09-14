import type { SupabaseClient } from "@supabase/supabase-js";
import { getAlbumRole } from "./membership";
import {
  buildMediaPage,
  mergeSpotMedia,
  SPOT_PHOTOS_PAGE_SIZE,
  type SpotMediaPage,
  type SpotPostMediaRow,
} from "@/lib/posts/spot-photos";

/**
 * アルバム写真一覧 Task1: アルバム内の写真・動画を投稿をまたいで新着順に返す
 * 出典: docs/tasks/records/album-photos/01-album-photos-handler.md
 *       要件定義書3.6.2（v2.11）、3.6.3（メンバーは非公開投稿も閲覧できる）
 *
 * - メンバー（オーナー・編集者・閲覧者）以外には null（存在自体を伏せる）
 * - 公開・非公開を問わず含める。管理者が非公開化した投稿・写真・アルバムは除く（F-AD-05）
 * - アルバム内ではブロック関係による除外を行わない（3.8.2 の例外）ため、ブロックの絞り込みはしない
 */
const ALBUM_POSTS_FETCH_CAP = 500;

export async function getAlbumMediaPage(
  admin: SupabaseClient,
  viewerId: string,
  tripId: string,
  offset: number,
  limit: number = SPOT_PHOTOS_PAGE_SIZE
): Promise<SpotMediaPage | null> {
  const role = await getAlbumRole(admin, tripId, viewerId);
  if (!role) return null;

  const { data: trip, error: tripError } = await admin
    .from("trips")
    .select("id, user_id, hidden_at")
    .eq("id", tripId)
    .maybeSingle();
  if (tripError) throw tripError;
  if (!trip) return null;
  if (trip.hidden_at && trip.user_id !== viewerId) return null;

  const { data, error } = await admin
    .from("posts")
    .select("id, created_at, visibility, spots(name), post_photos(id, storage_url, video_url, media_type, display_order, hidden_at)")
    .eq("trip_id", tripId)
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(ALBUM_POSTS_FETCH_CAP);
  if (error) throw error;

  const merged = mergeSpotMedia((data ?? []) as unknown as SpotPostMediaRow[], { includePrivate: true });
  return buildMediaPage(admin, merged, offset, limit);
}
