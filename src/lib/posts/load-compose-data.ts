import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExistingPostValues } from "@/components/posts/PostComposeScreen";
import type { PostCategory, PostDuration, PostVisibility } from "./constants";
import { createPostPhotoUrls } from "./signed-url";
import type { RegisteredSpot } from "@/lib/spots/types";

/**
 * post-entry-points Task1: 投稿画面の初期値をサーバーで読む
 * 出典: docs/tasks/posts/post-entry-points/01-compose-initial-state.md
 *
 * 【初心者向け】page.tsx（Server Component）から呼ぶ小さな取得関数をまとめたファイル。
 *   - loadExistingPostForCompose: 編集・下書きの続き（本人の投稿だけ）
 *   - loadSpotForCompose: ?spot= のスポット
 *   - loadItineraryForCompose: ?itinerary= のしおり（メンバーのときだけ。旅行タイトルと Day の日付）
 */
function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export async function loadExistingPostForCompose(admin: SupabaseClient, postId: string, userId: string): Promise<ExistingPostValues | null> {
  const { data: post } = await admin
    .from("posts")
    .select(
      "id, user_id, status, category, visit_date, duration, cost, rating, comment, visibility, lat, lng, trips(title), spots(id, name, lat, lng, prefecture, source)"
    )
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.user_id !== userId) return null;

  const { data: photos } = await admin
    .from("post_photos")
    .select("id, storage_url, media_type")
    .eq("post_id", postId)
    .order("display_order", { ascending: true });
  const signedUrls = await createPostPhotoUrls(
    admin,
    (photos ?? []).flatMap((photo) => (photo.storage_url ? [photo.storage_url] : []))
  );

  const trip = one(post.trips as { title: string } | { title: string }[] | null);
  const spot = one(post.spots as RegisteredSpot | RegisteredSpot[] | null);

  return {
    postId: post.id,
    status: post.status === "draft" ? "draft" : "published",
    values: {
      tripTitle: trip?.title ?? "",
      category: (post.category as PostCategory | null) ?? "",
      visitDate: post.visit_date ?? "",
      duration: (post.duration as PostDuration | null) ?? "",
      cost: post.cost === null ? "" : String(post.cost),
      rating: post.rating ?? 0,
      comment: post.comment ?? "",
      visibility: (post.visibility as PostVisibility) ?? "public",
    },
    spot,
    position: typeof post.lat === "number" && typeof post.lng === "number" ? { lat: post.lat, lng: post.lng } : spot ? { lat: spot.lat, lng: spot.lng } : null,
    photos: (photos ?? []).flatMap((photo) => {
      const url = photo.storage_url ? signedUrls.get(photo.storage_url) : undefined;
      return url ? [{ id: photo.id, url, mediaType: photo.media_type === "video" ? ("video" as const) : ("photo" as const) }] : [];
    }),
  };
}

export async function loadSpotForCompose(admin: SupabaseClient, spotId: string): Promise<RegisteredSpot | null> {
  const { data } = await admin.from("spots").select("id, name, lat, lng, prefecture, source").eq("id", spotId).maybeSingle();
  return (data as RegisteredSpot | null) ?? null;
}

export async function loadItineraryForCompose(
  admin: SupabaseClient,
  itineraryId: string,
  userId: string,
  day: string | null | undefined
): Promise<{ id: string; tripTitle: string; dayDate: string | null } | null> {
  const { data } = await admin
    .from("itineraries")
    .select("id, start_date, trips(title), itinerary_members!inner(user_id)")
    .eq("id", itineraryId)
    .eq("itinerary_members.user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const trip = one(data.trips as { title: string } | { title: string }[] | null);
  const dayIndex = day ? Number(day) : null;
  let dayDate: string | null = null;
  if (dayIndex && Number.isInteger(dayIndex) && dayIndex >= 1 && data.start_date) {
    const date = new Date(`${data.start_date}T00:00:00+09:00`);
    date.setUTCDate(date.getUTCDate() + dayIndex - 1);
    dayDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }
  return { id: data.id, tripTitle: trip?.title ?? "", dayDate };
}
