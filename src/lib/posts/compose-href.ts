/**
 * post-entry-points Task2: 各入口が `/posts/new` を開くときの href
 * 出典: docs/tasks/posts/post-entry-points/02-entry-links.md
 *       docs/tasks/posts/post-entry-points/01-compose-query.md
 *
 * 【初心者向け】投稿画面（SC-03）へ行く入口は 7 つあるが、URL の組み方はこの 1 か所に集める。
 *   - current  : SC-00「いまいる場所に投稿する」／地図の「ここに投稿」  → ?lat&lng&from=current（拒否時は座標なし）
 *   - location : 地図の長押し                                          → ?lat&lng
 *   - spot     : 既存ピンの「投稿する」・スポット別一覧・投稿詳細の「自分も投稿する」 → ?spot=
 *   - itinerary: しおりの「投稿する」（旅行タイトル・訪問日＝Day の日付）→ ?itinerary=&spot=&day=
 *   - draft    : 下書きの「続きを書く」                                → ?draft=
 * 読み取り側は lib/posts/compose-initial-state.ts（buildComposeInitialState）。
 * メニューバーには「投稿」を置かない（v3.0 でメニューから /posts/new への直リンクは廃止）。
 */
export type ComposeEntry =
  | { kind: "current"; lat?: number; lng?: number }
  | { kind: "location"; lat: number; lng: number }
  | { kind: "spot"; spotId: string }
  | { kind: "itinerary"; itineraryId: string; spotId: string; dayIndex?: number | null }
  | { kind: "draft"; draftId: string };

export function composeHref(input: ComposeEntry): string {
  const params = new URLSearchParams();
  switch (input.kind) {
    case "current":
      if (typeof input.lat === "number" && typeof input.lng === "number") {
        params.set("lat", String(input.lat));
        params.set("lng", String(input.lng));
      }
      params.set("from", "current");
      break;
    case "location":
      params.set("lat", String(input.lat));
      params.set("lng", String(input.lng));
      break;
    case "spot":
      params.set("spot", input.spotId);
      break;
    case "itinerary":
      params.set("itinerary", input.itineraryId);
      params.set("spot", input.spotId);
      if (input.dayIndex) params.set("day", String(input.dayIndex));
      break;
    case "draft":
      params.set("draft", input.draftId);
      break;
  }
  const query = params.toString();
  return query ? `/posts/new?${query}` : "/posts/new";
}
