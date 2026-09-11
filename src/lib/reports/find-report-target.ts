import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportTargetType } from "./constants";

/**
 * F-SF-01 Task3: 通報対象の存在確認
 * 出典: docs/tasks/safety/reporting/03-report-creation-handler.md
 *
 * reports.target_id にはFKが無い（ポリモーフィック関連）ため、INSERT前にここで
 * 対象種別ごとのテーブルを参照して実在を確認する。非公開投稿等の可視性は問わない
 * （通報者がURL等で到達できた対象は通報できてよい）。
 *
 * 戻り値の ownerId は「自分自身のコンテンツ／アカウントの通報」を弾く判定に使う。
 * spot は誰のものでもないため null。
 */
export interface ReportTarget {
  ownerId: string | null;
}

const TARGET_TABLES: Record<ReportTargetType, { table: string; ownerColumn: string | null }> = {
  post: { table: "posts", ownerColumn: "user_id" },
  // 感想テキストは posts.comment カラムなので、対象IDは投稿ID
  post_review: { table: "posts", ownerColumn: "user_id" },
  post_photo: { table: "post_photos", ownerColumn: null },
  comment: { table: "comments", ownerColumn: "user_id" },
  user: { table: "users", ownerColumn: "id" },
  spot: { table: "spots", ownerColumn: null },
  trip: { table: "trips", ownerColumn: "user_id" },
};

export async function findReportTarget(
  admin: SupabaseClient,
  targetType: ReportTargetType,
  targetId: string
): Promise<ReportTarget | null> {
  const { table, ownerColumn } = TARGET_TABLES[targetType];

  // 写真は投稿経由で投稿者を辿る
  if (targetType === "post_photo") {
    const { data, error } = await admin
      .from(table)
      .select("id, post:posts!inner(user_id)")
      .eq("id", targetId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const post = data.post as unknown as { user_id: string } | { user_id: string }[] | null;
    const owner = Array.isArray(post) ? post[0] : post;
    return { ownerId: owner?.user_id ?? null };
  }

  const columns = ownerColumn && ownerColumn !== "id" ? `id, ${ownerColumn}` : "id";
  let query = admin.from(table).select(columns).eq("id", targetId);
  if (targetType === "user") {
    // 退会済みユーザーは存在しない扱い（F-AC-05）
    query = query.eq("is_deleted", false);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as Record<string, string>;
  return { ownerId: ownerColumn ? row[ownerColumn] : null };
}
