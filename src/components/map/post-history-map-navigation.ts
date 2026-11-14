import type { MyMapPin, PostHistoryMapMode } from "@/lib/map/get-post-history-pins";
import { composeHref } from "@/lib/posts/compose-href";
import { appendBackHref } from "@/lib/search/list-state";

/**
 * F-RC-06 Task3 / my-map-v3 Task1（v3.0）: ピンタップ時の遷移先
 * 出典: docs/tasks/records/my-map/03-pin-tap-navigation.md
 *       docs/tasks/records/my-map-v3/01-fetch-and-toggle.md
 *       要件定義書 v3.0 3.6.5
 *   posted → 自分の投稿詳細（SC-05）、saved → 投稿一覧（SC-04）、draft → 続きを書く（SC-03）
 */
export function postHistoryPinHref(pin: Pick<MyMapPin, "kind" | "spotId" | "latestPostId">, backHref: string | null = null): string {
  if (pin.kind === "draft" && pin.latestPostId) {
    return composeHref({ kind: "draft", draftId: pin.latestPostId });
  }
  // Bug #471: 投稿詳細・スポット別一覧から「← 投稿履歴」で戻れるように back= を付ける
  if (pin.kind === "posted" && pin.latestPostId) {
    return appendBackHref(`/posts/${pin.latestPostId}`, backHref);
  }
  return pin.spotId ? appendBackHref(`/spots/${pin.spotId}`, backHref) : "/search";
}

/**
 * #1076（2026-11-14）: 投稿履歴の地図から移った先の「戻る」で、**地図タブ**に戻るための URL。
 *
 * 【初心者向け】投稿履歴（`/post-history`）は**一覧が既定**で、`?view=map` が付いたときだけ地図を開きます。
 * 前は戻り先を `/post-history` にしていたので、地図から投稿へ移って戻ると一覧が開いていました。
 * （この戻り先は #471 で書いたもので、当時は地図だけのページだったので `view` が要らなかった。
 * #682 で一覧／地図のタブができたときに、ここを直し忘れていた）
 *
 * 「両方／投稿のみ／行きたいのみ」の切り替えも `mode` に残して、戻ったときに同じ見え方にします。
 * 既定の「両方」は付けません（付けなくても「両方」で開くため、URL を短く保つ）。
 */
export function postHistoryMapBackHref(mode: PostHistoryMapMode): string {
  const params = new URLSearchParams({ view: "map" });
  if (mode !== "both") params.set("mode", mode);
  return `/post-history?${params.toString()}`;
}
