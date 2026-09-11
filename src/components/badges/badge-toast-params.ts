import { findBadgeDefinition } from "@/lib/badges/catalog";

/**
 * F-BG Task5: 投稿完了 → 遷移先 でバッジ獲得トーストを出すための受け渡し
 * 出典: docs/tasks/badges/status-badges/05-badge-toast-notification.md
 *
 * 投稿作成後はページ遷移するため、獲得バッジは URL クエリ `badges`（カンマ区切りの badge_type）
 * で遷移先へ渡す。通知一覧（SC-14）には記録しない。
 */
export const BADGE_TOAST_QUERY_KEY = "badges";

export function buildPostedHref(newBadgeTypes: string[]): string {
  const params = new URLSearchParams({ posted: "1" });
  if (newBadgeTypes.length > 0) {
    params.set(BADGE_TOAST_QUERY_KEY, newBadgeTypes.join(","));
  }
  return `/?${params.toString()}`;
}

/** クエリ値を badge_type の配列に戻す。カタログに無い値（改ざん・古いURL）は捨てる */
export function parseBadgeToastParam(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((type) => type.trim())
    .filter((type) => type.length > 0 && findBadgeDefinition(type) !== undefined);
}
