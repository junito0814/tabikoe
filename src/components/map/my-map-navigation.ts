import type { MyMapPin } from "@/lib/map/get-my-map-pins";

/**
 * F-RC-06 Task3: ピンタップ時の遷移先
 * 出典: docs/tasks/records/my-map/03-pin-tap-navigation.md
 *       要件定義書3.6.5（投稿済みピン → 自分の投稿詳細 SC-05、「行きたい」ピン → 投稿カード一覧 SC-04）
 */
export function myMapPinHref(pin: Pick<MyMapPin, "kind" | "spotId" | "latestPostId">): string {
  if (pin.kind === "posted" && pin.latestPostId) {
    return `/posts/${pin.latestPostId}`;
  }
  return `/spots/${pin.spotId}`;
}
