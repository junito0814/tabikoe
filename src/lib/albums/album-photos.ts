import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMediaPage, mergeMedia, PHOTOS_PAGE_SIZE, type SpotMediaPage, type SpotPostMediaRow } from "@/lib/posts/search-photos";
import { getAlbumRole } from "./membership";

/**
 * F-RC-05 Task1（SC-21 アルバム写真一覧）
 * 出典: docs/tasks/records/album-photos/01-album-photos-api.md
 *       docs/user-stories/records/album-photos.md
 *       要件定義書 3.6.3（アルバム内は非公開投稿も見える）
 *
 * 【初心者向け】検索の写真タブ（/api/posts/photos）と同じ「並べる → 1 ページ切り出す → 署名付き URL を付ける」を、
 * 取得元だけ「このアルバム（trip）の投稿」に変えたもの。違いは 3 つ:
 *   1. メンバーでなければ null（呼び出し側で 404。存在自体を伏せる）
 *   2. 非公開投稿も含める（メンバー限定の場なので。mergeMedia の includePrivate）
 *   3. ブロック関係で絞らない（同じアルバムのメンバー同士なので。要件 3.8.2 の例外）
 * 運営が非公開化した投稿・写真（hidden_at）は除く。非公開化されたアルバムはオーナーだけが見られる。
 */

/** アルバム写真一覧に出す投稿の上限（それ以上古いものは出さない） */
export const ALBUM_PHOTOS_POST_CAP = 500;

export async function getAlbumMediaPage(
  admin: SupabaseClient,
  viewerId: string,
  tripId: string,
  offset: number,
  limit: number = PHOTOS_PAGE_SIZE
): Promise<SpotMediaPage | null> {
  const role = await getAlbumRole(admin, tripId, viewerId);
  if (!role) return null;

  const { data: trip, error: tripError } = await admin.from("trips").select("id, user_id, hidden_at").eq("id", tripId).maybeSingle();
  if (tripError) throw tripError;
  if (!trip) return null;
  // F-AD-05: 非公開化されたアルバムはオーナー以外には無いものとして扱う
  if (trip.hidden_at && trip.user_id !== viewerId) return null;

  const { data, error } = await admin
    .from("posts")
    .select(
      "id, created_at, visibility, rating, duration, cost, visit_date, spots(name, source), users(display_name, is_deleted), post_photos(id, storage_url, video_url, media_type, display_order, hidden_at)"
    )
    .eq("trip_id", tripId)
    .eq("status", "published")
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(ALBUM_PHOTOS_POST_CAP);
  if (error) throw error;

  // 新着順（投稿順）に、同じ投稿の写真は添付順で並ぶ。非公開投稿も含める
  const merged = mergeMedia((data ?? []) as unknown as SpotPostMediaRow[], { includePrivate: true });
  return buildMediaPage(admin, merged, offset, limit);
}
