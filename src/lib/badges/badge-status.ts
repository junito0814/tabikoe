import type { SupabaseClient } from "@supabase/supabase-js";
import { BADGE_CATALOG, type BadgeDefinition } from "./catalog";

/**
 * F-BG Task4: カタログと獲得記録を突合し、SC-10 の表示用データを作る
 * 出典: docs/tasks/badges/status-badges/04-badge-screen-ui.md
 */
export interface BadgeStatus extends BadgeDefinition {
  /** 獲得日時（ISO 8601）。未獲得は null */
  acquiredAt: string | null;
}

export interface AcquiredBadgeRow {
  badge_type: string;
  acquired_at: string;
}

/** カタログの全バッジに獲得日時を付ける（純粋関数。単体テストの対象） */
export function mergeBadgeStatus(acquired: AcquiredBadgeRow[]): BadgeStatus[] {
  const acquiredAtByType = new Map(acquired.map((row) => [row.badge_type, row.acquired_at]));
  return BADGE_CATALOG.map((badge) => ({
    ...badge,
    acquiredAt: acquiredAtByType.get(badge.type) ?? null,
  }));
}

/**
 * ログインユーザーのバッジ一覧。badges は本人が RLS（badges_select_own）で読めるため
 * ユーザー権限クライアントで取得する。
 */
export async function getBadgeStatuses(
  supabase: SupabaseClient,
  userId: string
): Promise<BadgeStatus[]> {
  const { data, error } = await supabase
    .from("badges")
    .select("badge_type, acquired_at")
    .eq("user_id", userId);
  if (error) throw error;
  return mergeBadgeStatus((data ?? []) as AcquiredBadgeRow[]);
}
