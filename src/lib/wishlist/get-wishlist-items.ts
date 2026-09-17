import type { SupabaseClient } from "@supabase/supabase-js";
import { getBlockedUserIds } from "@/lib/blocks/get-blocked-user-ids";
import { createPostPhotoUrls } from "@/lib/posts/signed-url";
import { resolveWishlistThumbnail, type WishlistItem } from "./constants";

/**
 * F-RC-05 Task2: ログインユーザーの「行きたい」スポット一覧を組み立てる
 * 出典: docs/tasks/records/wishlist/02-wishlist-list-screen.md
 *
 * GET /api/wishlist と SC-08（Server Component）の両方が使う。
 * サムネイルは、そのスポットに紐づく閲覧可能な投稿（公開投稿 or 自分の投稿、
 * ブロック関係のユーザーは除く 3.8.2）のうち最新の1枚目の写真。無ければプレースホルダ。
 *
 * wishlist の読み取りは RLS（wishlist_owner_all）に任せてよいが、
 * 投稿・写真の参照は他人の行に及ぶため service_role で行い、可視性はここで判定する。
 */
interface WishlistRow {
  spot_id: string;
  created_at: string;
  spot: { id: string; name: string; prefecture: string | null; lat: number; lng: number } | null;
}

interface PostRow {
  spot_id: string;
  user_id: string;
  created_at: string;
  post_photos: { storage_url: string | null; media_type: string; display_order: number }[];
}

export async function getWishlistItems(
  admin: SupabaseClient,
  userId: string
): Promise<WishlistItem[]> {
  const { data, error } = await admin
    .from("wishlist")
    .select("spot_id, created_at, spot:spots(id, name, prefecture, lat, lng)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as unknown as WishlistRow[];
  const spotIds = rows.map((row) => row.spot_id);
  const photoPathBySpot = await findLatestPhotoPaths(admin, userId, spotIds);
  const urls = await createPostPhotoUrls(admin, Array.from(new Set(photoPathBySpot.values())));

  return rows
    .filter((row) => row.spot !== null)
    .map((row) => {
      const spot = row.spot!;
      const path = photoPathBySpot.get(row.spot_id);
      const photoUrl = path ? urls.get(path) : undefined;
      return {
        spotId: spot.id,
        name: spot.name,
        prefecture: spot.prefecture,
        lat: spot.lat,
        lng: spot.lng,
        savedAt: row.created_at,
        ...resolveWishlistThumbnail(photoUrl),
      };
    });
}

/** スポットごとに、閲覧可能な最新投稿の1枚目の写真パスを返す */
async function findLatestPhotoPaths(
  admin: SupabaseClient,
  userId: string,
  spotIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (spotIds.length === 0) return result;

  const blockedIds = await getBlockedUserIds(admin, userId);

  let query = admin
    .from("posts")
    .select("spot_id, user_id, created_at, post_photos(storage_url, media_type, display_order)")
    .in("spot_id", spotIds)
    .eq("status", "published")
    .or(`visibility.eq.public,user_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (blockedIds.length > 0) {
    query = query.not("user_id", "in", `(${blockedIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error) throw error;

  for (const post of (data ?? []) as unknown as PostRow[]) {
    if (result.has(post.spot_id)) continue;
    const photo = [...post.post_photos]
      .filter((item) => item.media_type === "photo" && item.storage_url)
      .sort((a, b) => a.display_order - b.display_order)[0];
    if (photo?.storage_url) {
      result.set(post.spot_id, photo.storage_url);
    }
  }

  return result;
}
