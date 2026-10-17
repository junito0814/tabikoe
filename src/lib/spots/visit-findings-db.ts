import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isVisitFinding, normalizeVisitFindings, spotIdsWithAllFindings, VISIT_FINDINGS, type VisitFinding } from "./visit-findings";

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

/** スポット画面に出す 1 項目分（件数と、いちばん新しい報告の日時） */
export interface VisitFindingSummary {
  finding: VisitFinding;
  count: number;
  latestAt: string;
}

/**
 * そのスポットの報告を、**項目ごとに数えて**返す（新しい順ではなく、項目の決まった並び）。
 *
 * 【初心者向け】**割合は出しません**（要件 4.5.19）。空欄は「ダメだった」ではなく
 * 「連れていなかった」なので、分母が作れないためです。**0 件の項目は返しません**
 * （「ペット不可」とは絶対に書かない、の裏返し）。
 */
export async function summarizeVisitFindings(admin: SupabaseClient, spotId: string): Promise<VisitFindingSummary[]> {
  const { data, error } = await admin
    .from("spot_visit_findings")
    .select("finding, reported_at")
    .eq("spot_id", spotId);
  if (error || !data) return [];

  const byFinding = new Map<VisitFinding, { count: number; latestAt: string }>();
  for (const row of data as { finding: string; reported_at: string }[]) {
    if (!isVisitFinding(row.finding)) continue;
    const current = byFinding.get(row.finding);
    if (!current) byFinding.set(row.finding, { count: 1, latestAt: row.reported_at });
    else {
      current.count += 1;
      if (row.reported_at > current.latestAt) current.latestAt = row.reported_at;
    }
  }
  // 並びは項目の決まった順（投稿画面と同じ）。件数順にはしない ── 件数の多さは重要さではないため
  return VISIT_FINDINGS.flatMap((finding) => {
    const found = byFinding.get(finding);
    return found ? [{ finding, count: found.count, latestAt: found.latestAt }] : [];
  });
}

/**
 * #929-c: 選んだ項目を**すべて**満たすスポットの id を引く。条件が空なら `null`（＝絞らない）。
 *
 * 【初心者向け】判定そのものは純粋関数（`spotIdsWithAllFindings`）に置いてあり、ここは
 * **DB から材料を取ってくるだけ**です。検索結果の一覧と地図の探すモードが、
 * どちらもこの関数を呼ぶので、同じスポットが出ます。
 *
 * 絞り込みに使う項目の行だけを引きます（11 項目のうち選んだぶんだけ）。
 */
export async function findSpotIdsWithAllFindings(
  admin: SupabaseClient,
  findings: readonly VisitFinding[]
): Promise<Set<string> | null> {
  if (findings.length === 0) return null;
  const { data, error } = await admin.from("spot_visit_findings").select("spot_id, finding").in("finding", [...findings]);
  if (error || !data) return new Set();
  return spotIdsWithAllFindings(
    (data as { spot_id: string; finding: string }[]).map((row) => ({ spotId: row.spot_id, finding: row.finding })),
    findings
  );
}
