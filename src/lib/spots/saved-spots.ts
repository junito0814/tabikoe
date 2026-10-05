import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 出典: #696（保存済みのスポットでは「＋」をチェックにする）
 * 要件定義書 3.6.4「「行きたい」保存と保存先の 2 択」・ワイヤーフレーム決定事項 76
 *
 * **「保存済み」＝「行きたい」か「しおり」のどちらかに入っている。**
 *
 * 【初心者向け】保存先は 2 つある（3.6.4）。片方しか見ていないと、
 * しおりに入れたスポットが「まだ保存していない」ように見えてしまう。
 *
 * この判断が 2 か所に写しで書かれていた（`post-cards.ts` と `search-spots.ts`。
 * どちらも `wishlist` だけを見ていた）。片方だけ直すとズレるので 1 つにまとめた（約束 14）。
 */
export async function findSavedSpotIds(
  admin: SupabaseClient,
  viewerId: string,
  spotIds: string[]
): Promise<Set<string>> {
  if (spotIds.length === 0) return new Set();

  const [wishlist, itineraries] = await Promise.all([
    admin.from("wishlist").select("spot_id").eq("user_id", viewerId).in("spot_id", spotIds),
    // 自分が入っているしおりに、そのスポットが入っているか
    admin
      .from("itinerary_spots")
      .select("spot_id, itineraries!inner(itinerary_members!inner(user_id))")
      .in("spot_id", spotIds)
      .eq("itineraries.itinerary_members.user_id", viewerId),
  ]);
  if (wishlist.error) throw wishlist.error;
  // しおり側が引けなくても「行きたい」だけで答える（✓ が出ないだけで、画面は壊さない）
  const saved = new Set((wishlist.data ?? []).map((row) => row.spot_id as string));
  for (const row of itineraries.data ?? []) saved.add(row.spot_id as string);
  return saved;
}
