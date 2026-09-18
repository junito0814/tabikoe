import { parseBackHref } from "@/lib/search/list-state";
import { CURRENT_LOCATION_ZOOM, TOKYO_STATION, type LatLng } from "./initial-center";

/**
 * map-display-v3 Task2: 地図（SC-02）をどう開くか（URL クエリ → 開き方）
 * 出典: docs/tasks/map-search/map-display-v3/02-map-screen-rebuild.md
 *       docs/tasks/browsing/explore-mode/02-explore-mode-ui.md
 *       要件定義書 v3.0 3.4.1・3.4.5
 *
 * 【初心者向け】同じ地図画面を 3 通りで開く。純粋関数にして単体テストで確かめる。
 *   - /map?mode=explore&lat&lng     : 探すモード（現在地中心、下に「近くの声」）。戻るは「ホーム」
 *   - /map?spot=<id>&lat&lng&back=  : スポット中心（フォーカスピン＋吹き出し）。戻るは「一覧に戻る」（back の URL）
 *   - /map?itinerary=<id>           : しおりの地図（Phase 13）。戻るは「しおりに戻る」
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
  /** しおりの地図で最初に開く Day（null＝未定、undefined＝Day 1） */
  itineraryDay?: number | null;
  /** 行きたい（SC-08）の地図: 保存済み（赤）のピンだけを出す */
  savedOnly?: boolean;
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
      back: back ? { href: back, label: "一覧に戻る" } : { href: "/", label: "ホーム" },
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
      itineraryDay: params.day === "undecided" ? null : Number.isInteger(dayNumber) && dayNumber >= 1 ? dayNumber : undefined,
      back: { href: `/itineraries/${params.itinerary}`, label: "しおりに戻る" },
    };
  }
  if (params.mode === "explore") {
    return {
      mode: "explore",
      // 位置情報が無い探すモードは東京駅にせず、呼び出し側（page.tsx）が検索トップへ戻す
      center: center ?? TOKYO_STATION,
      zoom: CURRENT_LOCATION_ZOOM + 1,
      focusSpotId: null,
      itineraryId: null,
      back: { href: "/", label: "ホーム" },
    };
  }
  return { mode: "default", center, zoom: CURRENT_LOCATION_ZOOM, focusSpotId: null, itineraryId: null, back: { href: "/", label: "ホーム" } };
}
