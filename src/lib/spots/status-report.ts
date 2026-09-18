import type { SupabaseClient } from "@supabase/supabase-js";
import type { LatestSpotStatus, SpotStatus } from "./format-status-label";

/**
 * spot-status-report Task1: 「まだあった／無くなっていた」報告
 * 出典: docs/tasks/browsing/spot-status-report/01-report-api.md
 *       要件定義書 v3.0 3.5.5
 *
 * 【初心者向け】spot_status_reports は主キーが (spot_id, user_id) なので、同じ人の 2 回目は UPSERT で上書きになる
 * （行が増えない）。表示に使うのは「スポットごとの最新 1 件」で、ビュー spot_latest_status から読む。
 * 投稿者への通知は作らない（場所の鮮度を保つための報告であり評価ではない）。
 */
export const SPOT_STATUSES: readonly SpotStatus[] = ["still_there", "gone"];

export function parseSpotStatus(value: unknown): SpotStatus | null {
  return value === "still_there" || value === "gone" ? value : null;
}

export interface SpotStatusSummary {
  /** スポットの最新の報告（誰のでも）。無ければ null */
  latest: LatestSpotStatus | null;
  /** 自分の報告。無ければ null */
  mine: LatestSpotStatus | null;
}

/** 報告を保存（2 回目は上書き）し、保存後の要約を返す */
export async function upsertSpotStatusReport(
  admin: SupabaseClient,
  spotId: string,
  userId: string,
  status: SpotStatus
): Promise<SpotStatusSummary> {
  const reportedAt = new Date().toISOString();
  const { error } = await admin
    .from("spot_status_reports")
    .upsert({ spot_id: spotId, user_id: userId, status, reported_at: reportedAt }, { onConflict: "spot_id,user_id" });
  if (error) throw error;
  return getSpotStatus(admin, spotId, userId);
}

export async function getSpotStatus(admin: SupabaseClient, spotId: string, userId: string): Promise<SpotStatusSummary> {
  const [latestResult, mineResult] = await Promise.all([
    admin.from("spot_latest_status").select("status, reported_at").eq("spot_id", spotId).maybeSingle(),
    admin.from("spot_status_reports").select("status, reported_at").eq("spot_id", spotId).eq("user_id", userId).maybeSingle(),
  ]);
  if (latestResult.error) throw latestResult.error;
  if (mineResult.error) throw mineResult.error;
  const toStatus = (row: { status: string; reported_at: string } | null): LatestSpotStatus | null => {
    const status = parseSpotStatus(row?.status);
    return row && status ? { status, reportedAt: row.reported_at } : null;
  };
  return { latest: toStatus(latestResult.data), mine: toStatus(mineResult.data) };
}
