/**
 * wishlist-v3 Task2: 「行きたい」の表示（一覧／地図）の値と読み取り
 * 出典: docs/tasks/records/wishlist-v3/02-wishlist-list-map-toggle.md
 *
 * 【初心者向け】`?view=map` を読む純粋関数。サーバー（/wishlist の page.tsx）とブラウザ（WishlistScreen）の両方から使うので、
 * `"use client"` の付いたコンポーネントファイルではなく、この何も付かないファイルに置く（#419 と同じ理由）。
 */
export type WishlistView = "list" | "map";

export function parseWishlistView(value: string | null | undefined): WishlistView {
  return value === "map" ? "map" : "list";
}
