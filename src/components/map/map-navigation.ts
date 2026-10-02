import { parseBackHref } from "@/lib/search/list-state";
import { backLabelFor, classifyBackHref } from "@/lib/map/back-label";
import { parseTravelMode, type TravelMode } from "@/lib/geo/travel-time";
import { EMPTY_SPOT_FILTERS, parseSpotFilters, type SpotFilters } from "@/lib/map/spot-aggregate";
import { CURRENT_LOCATION_ZOOM, TOKYO_STATION, type LatLng } from "./initial-center";

/**
 * map-display-v3 Task2: 地図（SC-02）をどう開くか（URL クエリ → 開き方）
 * 出典: docs/tasks/map-search/map-display-v3/02-map-screen-rebuild.md
 *       docs/tasks/browsing/explore-mode/02-explore-mode-ui.md
 *       要件定義書 v3.0 3.4.1・3.4.5
 *
 * 【初心者向け】同じ地図画面を 3 通りで開く。純粋関数にして単体テストで確かめる。
 *   - /map?mode=explore&lat&lng     : 探すモード（現在地中心、下に「近くの声」）。戻るは「ホーム」
 *   - /map?spot=<id>&lat&lng&back=  : スポット中心（フォーカスピン＋吹き出し）。戻るは戻り先の画面名（back の URL から。v3.1）
 *   - /map?itinerary=<id>           : しおりの地図（Phase 13）。戻るは「しおり」
 *   - /map                          : 通常。戻るは「ホーム」
 */
export type MapMode = "default" | "explore" | "spot" | "itinerary";

export interface MapOpenOptions {
  mode: MapMode;
  /** 指定があればこの位置で開く（無ければ現在地→東京駅） */
  center: LatLng | null;
  zoom: number;
  focusSpotId: string | null;
  itineraryId: string | null;
  /** しおりの地図で最初に開く Day（数字。undefined＝ALL。v3.1 で「日付なし」タブは廃止） */
  itineraryDay?: number;
  /** 行きたい（SC-08）の地図: 保存済み（赤）のピンだけを出す */
  savedOnly?: boolean;
  /** v3.2: 探すモードの移動手段（?travel=walk|bicycle|car。無ければ徒歩） */
  travel?: TravelMode;
  /** explore-mode Task 4: 探すモードの絞り込み（?categories=&cost=&duration=&rating=&manual=1） */
  filters?: SpotFilters;
  back: { href: string; label: string };
}

/** スポット中心で開くときのズーム（1 つのスポットが分かる程度） */
export const SPOT_FOCUS_ZOOM = 16;

function num(value: string | null | undefined): number | null {
  if (value === undefined || value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveMapOpen(params: {
  mode?: string | null;
  spot?: string | null;
  lat?: string | null;
  lng?: string | null;
  back?: string | null;
  itinerary?: string | null;
  day?: string | null;
  travel?: string | null;
  /** explore-mode Task 4: 絞り込み（投稿一覧と同じ名前。地図だけ rating・manual が増える） */
  categories?: string | null;
  cost?: string | null;
  duration?: string | null;
  rating?: string | null;
  manual?: string | null;
  /** v3.1: back がスポット別・投稿詳細のときのスポット名（page.tsx がサーバーで引く） */
  backSpotName?: string | null;
}): MapOpenOptions {
  const lat = num(params.lat);
  const lng = num(params.lng);
  const center = lat !== null && lng !== null ? { lat, lng } : null;

  if (params.spot) {
    const back = parseBackHref(params.back);
    return {
      mode: "spot",
      center,
      zoom: SPOT_FOCUS_ZOOM,
      focusSpotId: params.spot,
      itineraryId: null,
      // v3.1（mentoring-7 Task6）: 「一覧に戻る」ではなく戻り先の画面名（大阪府／大阪駅／スポット名／しおり／ホーム）
      back: back ? { href: back, label: backLabelFor(classifyBackHref(back), params.backSpotName ?? null) } : { href: "/", label: "ホーム" },
    };
  }
  if (params.itinerary) {
    const dayNumber = params.day ? Number.parseInt(params.day, 10) : Number.NaN;
    return {
      mode: "itinerary",
      center,
      zoom: CURRENT_LOCATION_ZOOM,
      focusSpotId: null,
      itineraryId: params.itinerary,
      // v3.1: 「日付なし」タブは廃止。数字以外（無し・all・旧 undecided）は ALL（undefined）
      itineraryDay: Number.isInteger(dayNumber) && dayNumber >= 1 ? dayNumber : undefined,
      back: { href: `/itineraries/${params.itinerary}`, label: "しおり" },
    };
  }
  if (params.mode === "explore") {
    return {
      mode: "explore",
      // explore-mode Task 4: 条件は URL に持つ（リロード・戻るで同じ条件に戻るため。3.4.6）
      filters: spotFiltersFrom({
        categories: params.categories,
        cost: params.cost,
        duration: params.duration,
        rating: params.rating,
        manual: params.manual,
      }),
      // 位置情報が無い探すモードは東京駅にせず、呼び出し側（page.tsx）が検索トップへ戻す
      center: center ?? TOKYO_STATION,
      zoom: CURRENT_LOCATION_ZOOM + 1,
      focusSpotId: null,
      itineraryId: null,
      travel: parseTravelMode(params.travel),
      back: { href: "/", label: "ホーム" },
    };
  }
  return { mode: "default", center, zoom: CURRENT_LOCATION_ZOOM, focusSpotId: null, itineraryId: null, back: { href: "/", label: "ホーム" } };
}

/**
 * explore-mode Task 4: クエリ → 絞り込みの条件。
 *
 * 【初心者向け】判定そのものは `parseSpotFilters`（サーバーの API も同じものを使う）。
 * ここは「文字の組を URLSearchParams に詰め直す」だけ。
 */
function spotFiltersFrom(params: { categories?: string | null; cost?: string | null; duration?: string | null; rating?: string | null; manual?: string | null }): SpotFilters {
  const entries = Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return entries.length > 0 ? parseSpotFilters(new URLSearchParams(entries)) : EMPTY_SPOT_FILTERS;
}
