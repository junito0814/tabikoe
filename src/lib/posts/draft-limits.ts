import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_DRAFTS_PER_USER } from "./constants";

/**
 * draft Task1: 下書きの上限
 * 出典: docs/tasks/posts/draft/01-draft-save-api.md
 *       要件定義書 v3.0 3.3.7（1 ユーザーにつき 20 件）
 */
export async function countDrafts(admin: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await admin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "draft");
  if (error) throw error;
  return count ?? 0;
}

/** 新しい下書きを増やしてよいか（既存の下書きの更新には使わない） */
export function canCreateDraft(currentCount: number, limit: number = MAX_DRAFTS_PER_USER): boolean {
  return currentCount < limit;
}
