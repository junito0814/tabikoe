import type { SupabaseClient } from "@supabase/supabase-js";
import { isBlockedEitherWay } from "@/lib/blocks/get-blocked-user-ids";

/**
 * F-VW-02 Task1: いいねの対象判定
 * 出典: docs/tasks/browsing/likes/01-like-toggle-handler.md
 *       要件定義書3.5.2（対象は公開投稿のみ）・3.3.6
 */
export type LikeTargetResult =
  | { ok: true; post: { id: string; user_id: string } }
  | { ok: false; status: 404 | 403; error: "not_found" | "post_not_public" };

/** 純粋な判定部分（単体テストの対象） */
export function evaluateLikeTarget(
  post: { id: string; user_id: string; visibility: string } | null,
  blocked: boolean
): LikeTargetResult {
  if (!post || blocked) {
    return { ok: false, status: 404, error: "not_found" };
  }
  if (post.visibility !== "public") {
    return { ok: false, status: 403, error: "post_not_public" };
  }
  return { ok: true, post: { id: post.id, user_id: post.user_id } };
}

export async function findLikeTarget(
  admin: SupabaseClient,
  viewerId: string,
  postId: string
): Promise<LikeTargetResult> {
  const { data: post, error } = await admin
    .from("posts")
    .select("id, user_id, visibility")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw error;

  const blocked =
    post && post.user_id !== viewerId ? await isBlockedEitherWay(admin, viewerId, post.user_id) : false;
  return evaluateLikeTarget(post, blocked);
}

export async function countPostLikes(admin: SupabaseClient, postId: string): Promise<number> {
  const { count, error } = await admin
    .from("likes")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);
  if (error) throw error;
  return count ?? 0;
}
