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

function withAddMode(params: URLSearchParams, addMode?: AddModeParams | null): string {
  if (addMode) {
    params.set("itinerary", addMode.itinerary);
    if (addMode.day) params.set("day", addMode.day);
  }
  return `/search?${params.toString()}`;
}

export function buildSearchHref(target: DestinationSuggestion | { kind: "coords"; lat: number; lng: number; q: string }, addMode?: AddModeParams | null): string {
  const params = new URLSearchParams();
  switch (target.kind) {
    case "prefecture":
      params.set("pref", target.name);
      return withAddMode(params, addMode);
    case "spot":
      params.set("spot", target.spotId);
      return withAddMode(params, addMode);
    case "station":
    case "locality":
      params.set("q", target.name);
      return withAddMode(params, addMode);
    case "coords":
      params.set("lat", String(target.lat));
      params.set("lng", String(target.lng));
      params.set("q", target.q);
      return withAddMode(params, addMode);
  }
}
