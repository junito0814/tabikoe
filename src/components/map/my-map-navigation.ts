import type { MyMapPin } from "@/lib/map/get-my-map-pins";
import { composeHref } from "@/lib/posts/compose-href";

/**
 * F-RC-06 Task3 / my-map-v3 Task1（v3.0）: ピンタップ時の遷移先
 * 出典: docs/tasks/records/my-map/03-pin-tap-navigation.md
 *       docs/tasks/records/my-map-v3/01-fetch-and-toggle.md
 *       要件定義書 v3.0 3.6.5
 *   posted → 自分の投稿詳細（SC-05）、saved → 投稿一覧（SC-04）、draft → 続きを書く（SC-03）
 */
export function myMapPinHref(pin: Pick<MyMapPin, "kind" | "spotId" | "latestPostId">): string {
  if (pin.kind === "draft" && pin.latestPostId) {
    return composeHref({ kind: "draft", draftId: pin.latestPostId });
  }
  if (pin.kind === "posted" && pin.latestPostId) {
    return `/posts/${pin.latestPostId}`;
  }
  return pin.spotId ? `/spots/${pin.spotId}` : "/search";
}
