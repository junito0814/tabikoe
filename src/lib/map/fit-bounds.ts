import type { LatLng } from "@/components/map/initial-center";

/**
 * 出典: #681（検索結果に「地図」タブを足す）
 * 要件定義書 3.4.2「地図タブ」・ワイヤーフレーム決定事項 71
 *
 * **検索結果のスポットが全部入る範囲**を出す（純粋関数。約束 13）。
 *
 * 【初心者向け】地図を開いたときに「どこを見せるか」を決める計算。
 * 追加の通信はせず、カードが持っている緯度経度だけを使う。
 *
 * 地図の端にピンが貼り付かないよう、少しだけ余白を足している。
 * 1 件しか無いときは広がりが 0 になるので、そのときだけ決め打ちの幅にする。
 */
export interface MapRect {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** 1 件だけのときに取る広さ（度）。およそ 1km 四方 */
const SINGLE_POINT_SPAN = 0.01;

/** 端に貼り付かないための余白（広がりに対する割合） */
const PADDING_RATIO = 0.15;

export function boundsOfPoints(points: readonly LatLng[]): MapRect | null {
  if (points.length === 0) return null;

  let north = points[0]!.lat;
  let south = points[0]!.lat;
  let east = points[0]!.lng;
  let west = points[0]!.lng;
  for (const point of points) {
    north = Math.max(north, point.lat);
    south = Math.min(south, point.lat);
    east = Math.max(east, point.lng);
    west = Math.min(west, point.lng);
  }

  const latSpan = north - south;
  const lngSpan = east - west;
  const latPad = latSpan === 0 ? SINGLE_POINT_SPAN : latSpan * PADDING_RATIO;
  const lngPad = lngSpan === 0 ? SINGLE_POINT_SPAN : lngSpan * PADDING_RATIO;

  return {
    north: Math.min(90, north + latPad),
    south: Math.max(-90, south - latPad),
    east: east + lngPad,
    west: west - lngPad,
  };
}

/** `fitBounds` に渡す 2 点（南西・北東）にする */
export function rectCorners(rect: MapRect): LatLng[] {
  return [
    { lat: rect.south, lng: rect.west },
    { lat: rect.north, lng: rect.east },
  ];
}
