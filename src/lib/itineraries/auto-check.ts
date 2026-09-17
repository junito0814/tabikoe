import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * itinerary-check Task2: 投稿公開時の自動チェック
 * 出典: docs/tasks/itinerary/itinerary-check/02-auto-check-on-publish.md
 *       要件定義書 v3.0 3.11.5
 *
 * 【初心者向け】投稿が公開されたら、「同じ旅行（trip_id）のしおり」に「同じスポット」の行があり、
 * かつ投稿者がそのしおりのメンバーなら、その行にチェック（checked_at）を付ける。
 * しおりのメンバーでない人（アルバムのメンバーでも）の投稿では変えない。下書きでは呼ばれない。
 * 既にチェック済みなら触らない（手動チェックの日時を上書きしない）。
 */
export async function autoCheckItinerarySpots(
  admin: SupabaseClient,
  input: { userId: string; tripId: string; spotId: string }
): Promise<number> {
  const { data: itinerary, error } = await admin
    .from("itineraries")
    .select("id, itinerary_members!inner(user_id)")
    .eq("trip_id", input.tripId)
    .eq("itinerary_members.user_id", input.userId)
    .maybeSingle();
  if (error) throw error;
  if (!itinerary) return 0;

  const { data: updated, error: updateError } = await admin
    .from("itinerary_spots")
    .update({ checked_at: new Date().toISOString(), checked_by: input.userId })
    .eq("itinerary_id", itinerary.id)
    .eq("spot_id", input.spotId)
    .is("checked_at", null)
    .select("id");
  if (updateError) throw updateError;
  return updated?.length ?? 0;
}
