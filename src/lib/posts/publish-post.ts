import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluatePostBadges } from "@/lib/badges/award-badges";
import { findBadgeDefinition } from "@/lib/badges/catalog";
import { recordOperation } from "@/lib/logs/record-operation";
import { autoCheckItinerarySpots } from "@/lib/itineraries/auto-check";

export interface PostPublishedContext {
  postId: string;
  userId: string;
  tripId: string;
  spotId: string;
  prefecture: string | null;
  visibility: string;
  mediaCount: number;
  /** 下書きからの公開か（ログの種別に使う） */
  fromDraft: boolean;
}

/**
 * draft Task3 / post-creation-v3 Task1: 投稿が「公開」になった直後の共通処理
 * 出典: docs/tasks/posts/draft/03-draft-listing-and-publish.md
 *
 * 【初心者向け】新規作成でも下書きからの公開でも、公開の瞬間にやることは同じ：
 *   ①操作ログ ②バッジ判定（投稿数・都道府県） ③しおりの自動チェック（itinerary-check Task2）
 * どれも失敗しても投稿自体は成功させる（例外を外に出さない）。
 */
export async function afterPostPublished(admin: SupabaseClient, context: PostPublishedContext): Promise<{ type: string; label: string }[]> {
  await recordOperation(admin, {
    actionType: "post_create",
    userId: context.userId,
    targetId: context.postId,
    detail: { visibility: context.visibility, photoCount: context.mediaCount, fromDraft: context.fromDraft },
  });

  let newBadges: { type: string; label: string }[] = [];
  try {
    const awarded = await evaluatePostBadges(admin, context.userId, context.prefecture);
    newBadges = awarded.map((type) => ({ type, label: findBadgeDefinition(type)?.label ?? type }));
  } catch (error) {
    console.error("[badges] evaluatePostBadges failed", error);
  }

  try {
    await autoCheckItinerarySpots(admin, { userId: context.userId, tripId: context.tripId, spotId: context.spotId });
  } catch (error) {
    console.error("[itinerary] autoCheckItinerarySpots failed", error);
  }

  return newBadges;
}
