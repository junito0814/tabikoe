"use client";

import { SaveSheet, type SaveResult, type SaveSheetApi } from "./SaveSheet";

/**
 * wishlist-v3 Task2: 「しおりと Day を選ぶシート」（行きたい画面の「＋」）
 * 出典: docs/tasks/records/wishlist-v3/02-wishlist-list-map-toggle.md
 *
 * 【初心者向け】SaveSheet の「行きたい」の段を出さないだけの薄い包み。追加しても行きたいからは消えない。
 */
export function ItineraryPickerSheet({
  open,
  spotId,
  spotName,
  onClose,
  api,
}: {
  open: boolean;
  spotId: string;
  spotName: string;
  onClose: (result: SaveResult) => void;
  api?: SaveSheetApi;
}) {
  return <SaveSheet open={open} spotId={spotId} spotName={spotName} initialWishlisted showWishlist={false} onClose={onClose} api={api} />;
}
