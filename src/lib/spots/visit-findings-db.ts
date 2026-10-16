import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeVisitFindings, type VisitFinding } from "./visit-findings";

/**
 * #929: 「行ってわかったこと」の読み書き
 * 出典: Issue #929、要件定義書 4.5.19
 *
 * 【初心者向け】この報告は**投稿ではなくスポットに付きます**（1 人 1 スポット）。
 * 投稿画面で選びますが、保存先は投稿の表ではなく `spot_visit_findings` です。
 * 同じスポットに 2 回投稿しても報告は 1 つで、**後の選択で上書き**されます。
 */

/** そのスポットに対する、自分の報告（投稿画面を開いたときに、選んだ状態で出すために使う） */
export async function listMyVisitFindings(admin: SupabaseClient, userId: string, spotId: string): Promise<VisitFinding[]> {
  const { data, error } = await admin
    .from("spot_visit_findings")
    .select("finding")
    .eq("user_id", userId)
    .eq("spot_id", spotId);
  if (error) return [];
  return normalizeVisitFindings((data ?? []).map((row) => (row as { finding: string }).finding));
}

/**
 * 自分の報告を、選んだ状態に合わせる（**投稿したときの選択が、そのまま報告になる**）。
 *
 * 【初心者向け】**外したものは消します。** これが「間違えた報告を取り消す手段」になっていて、
 * そのために取り消し専用の画面を作らずに済んでいます（要件 4.5.19）。
 * いま入っているものと見比べて、**増えたぶんだけ入れ、減ったぶんだけ消します**
 * （全部消してから入れ直すと、報告した日時がそのたびに新しくなってしまうため）。
 */
export async function saveVisitFindings(
  admin: SupabaseClient,
  userId: string,
  spotId: string,
  selected: readonly VisitFinding[]
): Promise<void> {
  const next = new Set(normalizeVisitFindings(selected));
  const current = new Set(await listMyVisitFindings(admin, userId, spotId));

  const added = [...next].filter((finding) => !current.has(finding));
  const removed = [...current].filter((finding) => !next.has(finding));

  if (added.length > 0) {
    await admin.from("spot_visit_findings").insert(added.map((finding) => ({ spot_id: spotId, user_id: userId, finding })));
  }
  if (removed.length > 0) {
    await admin.from("spot_visit_findings").delete().eq("user_id", userId).eq("spot_id", spotId).in("finding", removed);
  }
}
