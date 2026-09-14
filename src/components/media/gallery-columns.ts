/**
 * F-MP-05 Task2: 画面幅に応じたグリッド列数
 * 出典: docs/tasks/map-search/spot-photo-gallery/02-gallery-screen-ui.md
 *       要件定義書3.4.5（正方形サムネイルのグリッド。列数は画面幅に応じて可変）
 *
 * サムネイル1点あたり最小約110pxを確保し、3〜6列の範囲で切り替える。
 */
export const MIN_GALLERY_COLUMNS = 3;
export const MAX_GALLERY_COLUMNS = 6;
const MIN_CELL_WIDTH_PX = 110;

export function gridColumnsForWidth(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return MIN_GALLERY_COLUMNS;
  const fit = Math.floor(containerWidth / MIN_CELL_WIDTH_PX);
  return Math.min(MAX_GALLERY_COLUMNS, Math.max(MIN_GALLERY_COLUMNS, fit));
}
