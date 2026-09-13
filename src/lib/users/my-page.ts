import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPostCards, type PostCardData, type PostCardRow } from "@/lib/posts/post-cards";

/**
 * F-RC-01 Task2・Task3: マイページのサマリー集計・自分の投稿一覧
 * 出典: docs/tasks/records/my-page/02-summary-aggregation-handler.md
 *       docs/tasks/records/my-page/03-my-posts-list-handler.md
 *       要件定義書3.6.1
 */
export interface MyPageSummary {
  /** 非公開投稿を含む投稿数 */
  postCount: number;
  /** 自分の投稿群に対する累計いいね数 */
  receivedLikeCount: number;
}

export async function getMyPageSummary(admin: SupabaseClient, userId: string): Promise<MyPageSummary> {
  const [posts, likes] = await Promise.all([
    // 公開設定で絞らない（非公開投稿も投稿数に含める。3.6.1）
    admin.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin
      .from("likes")
      .select("id, post:posts!inner(user_id)", { count: "exact", head: true })
      .eq("post.user_id", userId),
  ]);
  if (posts.error) throw posts.error;
  if (likes.error) throw likes.error;
  return { postCount: posts.count ?? 0, receivedLikeCount: likes.count ?? 0 };
}

export interface MyPost extends PostCardData {
  visibility: "public" | "private";
  tripId: string;
  tripTitle: string;
}

export interface MyPostsPage {
  posts: MyPost[];
  nextOffset: number | null;
}

export const MY_POSTS_PAGE_SIZE = 20;

type MyPostRow = PostCardRow & {
  visibility: string;
  trip_id: string;
  trips: { title: string } | { title: string }[] | null;
};

/** 旅行IDでの絞り込み条件（単体テストの対象）。指定なしなら全投稿 */
export function matchesTripFilter(post: { trip_id: string }, tripId: string | null): boolean {
  return tripId === null || post.trip_id === tripId;
}

/** 自分の投稿を新着順に返す（非公開含む）。`tripId` を渡すとその旅行の投稿だけ */
export async function getMyPosts(
  admin: SupabaseClient,
  userId: string,
  tripId: string | null,
  offset: number,
  limit: number = MY_POSTS_PAGE_SIZE
): Promise<MyPostsPage> {
  let query = admin
    .from("posts")
    .select(
      "id, spot_id, user_id, trip_id, category, visit_date, duration, cost, rating, comment, visibility, created_at, " +
        "spots(name), users(display_name, avatar_url), trips(title), " +
        "post_photos(storage_url, media_type, display_order), likes(count), comments(count)",
      { count: "exact" }
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (tripId) {
    query = query.eq("trip_id", tripId);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = ((data ?? []) as unknown as MyPostRow[]).filter((row) => matchesTripFilter(row, tripId));
  const cards = await buildPostCards(admin, userId, rows);
  const posts: MyPost[] = cards.map((card, index) => {
    const row = rows[index];
    const trip = Array.isArray(row.trips) ? row.trips[0] : row.trips;
    return {
      ...card,
      visibility: row.visibility === "private" ? "private" : "public",
      tripId: row.trip_id,
      tripTitle: trip?.title ?? "",
    };
  });

  const total = count ?? 0;
  return { posts, nextOffset: offset + rows.length < total ? offset + rows.length : null };
}

/** 絞り込み用の旅行一覧（自分がオーナーの旅行＋投稿がある旅行） */
export async function getMyTripOptions(
  admin: SupabaseClient,
  userId: string
): Promise<{ id: string; title: string }[]> {
  const { data, error } = await admin
    .from("posts")
    .select("trip_id, trips!inner(id, title)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const seen = new Map<string, string>();
  for (const row of (data ?? []) as unknown as { trip_id: string; trips: { id: string; title: string } | { id: string; title: string }[] | null }[]) {
    const trip = Array.isArray(row.trips) ? row.trips[0] : row.trips;
    if (trip && !seen.has(trip.id)) seen.set(trip.id, trip.title);
  }
  return Array.from(seen, ([id, title]) => ({ id, title }));
}
