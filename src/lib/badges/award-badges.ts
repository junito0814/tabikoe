import type { SupabaseClient } from "@supabase/supabase-js";
import {
  badgeTypeForPrefecture,
  reachedLikeCountBadgeTypes,
  reachedPostCountBadgeTypes,
} from "./catalog";

/**
 * F-BG Task2・Task3: バッジの判定・付与
 * 出典: docs/tasks/badges/status-badges/02-post-count-prefecture-badge-evaluation.md
 *       docs/tasks/badges/status-badges/03-like-count-badge-evaluation.md
 *
 * 付与は service_role で行う（badges は authenticated に SELECT しか許していない）。
 * 戻り値は「今回新たに獲得した badge_type」だけで、既に持っていたものは含まない
 * （Task5 のトースト表示に使う）。
 */

/**
 * 指定した badge_type を付与し、新規に付与できたものだけを返す。
 * (user_id, badge_type) の一意制約に当たった行は無視する（重複付与しない）。
 */
export async function awardBadges(
  admin: SupabaseClient,
  userId: string,
  badgeTypes: string[]
): Promise<string[]> {
  const unique = Array.from(new Set(badgeTypes));
  if (unique.length === 0) return [];

  const { data, error } = await admin
    .from("badges")
    .upsert(
      unique.map((badgeType) => ({ user_id: userId, badge_type: badgeType })),
      { onConflict: "user_id,badge_type", ignoreDuplicates: true }
    )
    .select("badge_type");

  if (error) throw error;
  return (data ?? []).map((row: { badge_type: string }) => row.badge_type);
}

/**
 * Task2: 投稿作成の保存完了後に呼ぶ。
 * - 投稿数バッジ: 累計投稿数（非公開含む）が到達している閾値をすべて候補にし、未取得分だけ付与
 * - 都道府県バッジ: 投稿したスポットの都道府県で初投稿なら付与（prefecture 未設定ならスキップ）
 *
 * 到達済み閾値を毎回候補にしても、既に持っているバッジは upsert（ignoreDuplicates）で
 * 弾かれるので重複付与にはならず、戻り値には新規分だけが載る。
 */
export async function evaluatePostBadges(
  admin: SupabaseClient,
  userId: string,
  spotPrefecture: string | null
): Promise<string[]> {
  const candidates: string[] = [];

  const { count, error } = await admin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    // v3.0: 下書きは投稿数に数えない
    .eq("status", "published");
  if (error) throw error;

  candidates.push(...reachedPostCountBadgeTypes(count ?? 0));

  const prefectureBadge = badgeTypeForPrefecture(spotPrefecture);
  if (prefectureBadge) candidates.push(prefectureBadge);

  return awardBadges(admin, userId, candidates);
}

/**
 * Task3: 投稿者の累計獲得いいね数を数える。自分の投稿への自分のいいねは除く。
 * いいね機能（F-VW-02, Phase 6）のRoute Handlerが、いいね保存後に呼ぶ。
 */
export async function countReceivedLikes(admin: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await admin
    .from("likes")
    .select("id, post:posts!inner(user_id)", { count: "exact", head: true })
    .eq("post.user_id", userId)
    .neq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Task3: 累計獲得いいね数が到達している閾値の like_count バッジのうち、未取得分を付与する。
 *
 * 組み込みガイド（いいね付与 Route Handler 側）:
 *   const total = await countReceivedLikes(admin, post.user_id);
 *   const newBadges = await awardLikeCountBadgeIfEligible(admin, post.user_id, total);
 * いいねは他ユーザーの操作なので、newBadges は投稿者にその場で見せられない（トースト対象外、Task5）。
 */
export async function awardLikeCountBadgeIfEligible(
  admin: SupabaseClient,
  userId: string,
  newTotalLikeCount: number
): Promise<string[]> {
  return awardBadges(admin, userId, reachedLikeCountBadgeTypes(newTotalLikeCount));
}
