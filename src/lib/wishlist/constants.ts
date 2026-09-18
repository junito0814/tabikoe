/**
 * F-RC-05 「行きたい」保存の定数（要件定義書3.6.4）
 */

/** 投稿が無いスポットの一覧表示に使うプレースホルダ画像（public/ 配下） */
export const SPOT_PLACEHOLDER_IMAGE_URL = "/spot-placeholder.svg";

/** 一覧に載せる「行きたい」スポット。投稿が無いスポットも含む */
export interface WishlistItem {
  spotId: string;
  name: string;
  prefecture: string | null;
  lat: number;
  lng: number;
  /** 保存日時（ISO 8601） */
  savedAt: string;
  /** 一覧のサムネイル。投稿写真の署名付きURL、無ければプレースホルダ */
  thumbnailUrl: string;
  /** サムネイルがプレースホルダかどうか（画面側で alt を切り替える） */
  hasPost: boolean;
  /** v3.0: 閲覧できる投稿の件数 */
  postCount: number;
  /** v3.0: 入っている自分のしおり（「大阪旅行 Day 1」の表示用） */
  itineraries: { id: string; title: string; dayIndex: number | null }[];
}

/**
 * サムネイルURLを決める。投稿写真が無い（undefined/null）スポットはプレースホルダ。
 * Task2 単体テストの対象。
 */
export function resolveWishlistThumbnail(photoUrl: string | null | undefined): {
  thumbnailUrl: string;
  hasPost: boolean;
} {
  if (photoUrl) {
    return { thumbnailUrl: photoUrl, hasPost: true };
  }
  return { thumbnailUrl: SPOT_PLACEHOLDER_IMAGE_URL, hasPost: false };
}
