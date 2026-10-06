import type { SupabaseClient } from "@supabase/supabase-js";
import { BADGE_CATALOG } from "@/lib/badges/catalog";
import { getBadgeStatuses } from "@/lib/badges/badge-status";
import { countRegisteredSpots } from "@/lib/badges/award-badges";
import { buildPostCards } from "@/lib/posts/post-cards";
import type { PostCardData } from "@/lib/posts/post-cards";

/**
 * #767（2026-10-06）: 他ユーザーのプロフィール（SC-33）に出す数字
 * 出典: Issue #767「Bug 2: 他ユーザーのプロフィールに戻るが無く、中身も無い」
 *       要件定義書 3.5.6（2026-10-06 で新設）
 *
 * 【初心者向け】この画面はこれまで**仕様が無く**、アイコン・名前・「通報する」「ブロック」
 * だけでした。自分のマイページ（3.6.1）の材料のうち、**編集できないもの**を出します。
 *
 *   - 投稿数 … **公開投稿だけ**（自分のマイページは非公開も含むが、他人には見せない）
 *   - 獲得いいね … 自分のマイページと同じ
 *   - 登録した場所 … スポット登録バッジと同じ数え方（`countRegisteredSpots`）
 *   - バッジ ◯/63 … 自分のマイページと同じ数え方
 */
export interface PublicProfileStats {
  /** 公開投稿の数（非公開・下書きは数えない） */
  postCount: number;
  receivedLikeCount: number;
  registeredSpotCount: number;
  badgeCount: number;
  badgeTotal: number;
}

export async function getPublicProfileStats(admin: SupabaseClient, userId: string): Promise<PublicProfileStats> {
  const [posts, likes, spots, badges] = await Promise.all([
    // 他人の画面なので**公開投稿だけ**数える（非公開があることも伝えない）
    admin
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "published")
      .eq("visibility", "public")
      .is("hidden_at", null),
    admin
      .from("likes")
      .select("id, post:posts!inner(user_id)", { count: "exact", head: true })
      .eq("post.user_id", userId)
      .neq("user_id", userId),
    countRegisteredSpots(admin, userId).catch(() => 0),
    getBadgeStatuses(admin, userId).catch((): [] => []),
  ]);
  return {
    postCount: posts.count ?? 0,
    receivedLikeCount: likes.count ?? 0,
    registeredSpotCount: spots,
    badgeCount: badges.filter((badge) => badge.acquiredAt !== null).length,
    badgeTotal: BADGE_CATALOG.length,
  };
}

/**
 * その人の**公開投稿**（新着順）。非公開・下書き・非表示は出さない。
 *
 * 【初心者向け】`getMyPosts`（自分の投稿）と形は同じですが、
 * **公開のものだけ**に絞ります。`viewerId` はカードの「いいね済み」「保存済み」を
 * 見ている人の目線で付けるために渡します。
 */
export async function getPublicPostsByUser(
  admin: SupabaseClient,
  userId: string,
  viewerId: string,
  offset: number,
  limit: number = PUBLIC_POSTS_PAGE_SIZE
): Promise<{ posts: PostCardData[]; nextOffset: number | null }> {
  const { data, error, count } = await admin
    .from("posts")
    .select(
      "id, spot_id, user_id, trip_id, category, visit_date, duration, cost, rating, comment, visibility, created_at, " +
        "spots(name), users(display_name, avatar_url), trips(title), " +
        "post_photos(storage_url, media_type, display_order), likes(count), comments(count)",
      { count: "exact" }
    )
    .eq("user_id", userId)
    .eq("status", "published")
    .eq("visibility", "public")
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Parameters<typeof buildPostCards>[2];
  const posts = await buildPostCards(admin, viewerId, rows);
  const total = count ?? 0;
  return { posts, nextOffset: offset + posts.length < total ? offset + posts.length : null };
}

export const PUBLIC_POSTS_PAGE_SIZE = 20;
