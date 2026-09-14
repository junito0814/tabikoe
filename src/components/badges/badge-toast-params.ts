import { findBadgeDefinition } from "@/lib/badges/catalog";

/**
 * F-BG Task5: 投稿完了 → 遷移先 でバッジ獲得トーストを出すための受け渡し
 * 出典: docs/tasks/badges/status-badges/05-badge-toast-notification.md
 *
 * 投稿作成・編集後はページ遷移するため、獲得バッジは URL クエリ `badges`（カンマ区切りの badge_type）
 * で遷移先へ渡す。通知一覧（SC-14）には記録しない。
 */
export const BADGE_TOAST_QUERY_KEY = "badges";

function buildFlashHref(flashKey: "posted" | "updated", newBadgeTypes: string[]): string {
  const params = new URLSearchParams({ [flashKey]: "1" });
  if (newBadgeTypes.length > 0) {
    params.set(BADGE_TOAST_QUERY_KEY, newBadgeTypes.join(","));
  }
  return `/?${params.toString()}`;
}

/** 投稿作成後の遷移先 */
export function buildPostedHref(newBadgeTypes: string[]): string {
  return buildFlashHref("posted", newBadgeTypes);
}

/** 投稿編集後の遷移先。編集でスポットの都道府県が変わるとご当地バッジを獲得しうる（#251） */
export function buildUpdatedHref(newBadgeTypes: string[]): string {
  return buildFlashHref("updated", newBadgeTypes);
}

/** クエリ値を badge_type の配列に戻す。カタログに無い値（改ざん・古いURL）は捨てる */
export function parseBadgeToastParam(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((type) => type.trim())
    .filter((type) => type.length > 0 && findBadgeDefinition(type) !== undefined);
}
