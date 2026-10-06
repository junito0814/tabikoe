import type { DestinationSuggestion } from "./suggest-destinations";

/**
 * search-top Task3: 候補の種別ごとの遷移先 URL
 * 出典: docs/tasks/map-search/search-top/03-submit-and-geocode.md
 *       要件定義書 v3.0 3.4.1「決定時」・3.4.2「検索の判定」
 *
 * 【初心者向け】投稿一覧（/search）は 3 通りの条件を受ける。
 *   - 都道府県:   /search?pref=大阪府
 *   - 駅・市区町村: /search?lat=&lng=&q=大阪駅（座標は決定時に Geocoding で求める）
 *   - スポット:   /search?spot=<id>（スポット別一覧）
 * しおりの追加モード（?itinerary=&day=）は、そのまま引き継ぐ。
 */
export interface AddModeParams {
  itinerary: string;
  day: string | null;
}

/**
 * #756（2026-10-06）: どこから来たか（`back=`）。
 *
 * 【初心者向け】ホームの「どこ行く？」でスポットを選ぶと、開いた先の戻るが **「‹ 地図」**
 * になっていました。既定値が「地図」なのは**地図のピンから来た場合**のためで（Bug #469）、
 * それ自体は正しい。問題は**ホームから来たことを誰も伝えていない**ことでした。
 * ここで `back=` を付ければ、受け取る側（`resolveListBack`）が「ホーム」と読んでくれます。
 */
function withExtras(params: URLSearchParams, addMode?: AddModeParams | null, back?: string | null): string {
  if (addMode) {
    params.set("itinerary", addMode.itinerary);
    if (addMode.day) params.set("day", addMode.day);
  }
  if (back) params.set("back", back);
  return `/search?${params.toString()}`;
}

export function buildSearchHref(
  target: DestinationSuggestion | { kind: "coords"; lat: number; lng: number; q: string },
  addMode?: AddModeParams | null,
  /** 来た画面の URL。ホームの「どこ行く？」からは "/"（戻るが「ホーム」になる） */
  back?: string | null
): string {
  const params = new URLSearchParams();
  switch (target.kind) {
    case "prefecture":
      params.set("pref", target.name);
      return withExtras(params, addMode, back);
    case "spot":
      params.set("spot", target.spotId);
      return withExtras(params, addMode, back);
    case "station":
    case "locality":
      params.set("q", target.name);
      return withExtras(params, addMode, back);
    case "coords":
      params.set("lat", String(target.lat));
      params.set("lng", String(target.lng));
      params.set("q", target.q);
      return withExtras(params, addMode, back);
  }
}
