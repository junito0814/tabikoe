import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * そのスポットに付いている、いま見られる投稿の件数
 * 出典: 要件定義書 3.4.2（スポット別一覧の「投稿 N 件」）・4.5.18（#951 の「この場所の投稿をすべて見る（N 件）」）
 *
 * 【初心者向け】「いま見られる」は**公開・公開済み・運営が隠していない**の 3 つを満たすもの。
 * この 3 つの条件は 2 か所で使うので、1 つにまとめてあります（片方だけ直すと件数がずれるため。約束 14）。
 */
export async function countPublicSpotPosts(admin: SupabaseClient, spotId: string): Promise<number> {
  const { count } = await admin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("spot_id", spotId)
    .eq("visibility", "public")
    .eq("status", "published")
    .is("hidden_at", null);
  return count ?? 0;
}
