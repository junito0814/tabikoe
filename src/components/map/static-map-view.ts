import type { LatLng } from "./initial-center";

/**
 * map-sheet Task1（2026-09-26）: 上部の地図が「初期表示から動いたか」の判定
 * 出典: docs/tasks/shared-ui/map-sheet/01-pinch-and-zoom-controls.md
 *       要件定義書 4.5.8「上部の地図の操作と拡大縮小ボタン」
 *
 * 【初心者向け】上部の地図は 2 本指で動かせるようになった。動かしたあとだけ「戻す」を出したいので、
 * 今の中心・ズームが初期表示と同じかどうかをここで見る。
 * 中心はぴったり一致しないことがある（地図の内部で小数の丸めが起きる）ので、
 * わずかな差は「動いていない」と見なす。
 */
export interface MapView {
  center: LatLng;
  zoom: number;
}

/** 同じ場所と見なす中心のずれ（度）。緯度 0.00015 度 ≒ 17m */
export const SAME_VIEW_DEGREES = 0.00015;

/** 2 つの表示が同じか（中心がほぼ同じで、ズームも同じ） */
export function isSameView(a: MapView, b: MapView): boolean {
  if (a.zoom !== b.zoom) return false;
  return Math.abs(a.center.lat - b.center.lat) < SAME_VIEW_DEGREES && Math.abs(a.center.lng - b.center.lng) < SAME_VIEW_DEGREES;
}
