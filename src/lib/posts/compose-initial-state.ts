import type { RegisteredSpot } from "@/lib/spots/types";
import { todayInJst } from "./constants";

/**
 * post-entry-points Task1: `/posts/new` のクエリから投稿画面の初期状態を組み立てる
 * 出典: docs/tasks/posts/post-entry-points/01-compose-initial-state.md
 *       要件定義書 v3.0 3.3.8（投稿の起点）
 *
 * 【初心者向け】SC-03 は 7 通りの入口から開かれる。どこから来たかを URL のクエリで受け取り、
 * 「地図の初期位置」「スポット欄」「旅行タイトル」「日付」の初期値をここで決める。純粋関数なので単体テストしやすい。
 *   ?lat&lng            → その点を中心（現在地／長押し）。スポットは位置から解決（画面側）
 *   ?spot=<id>          → そのスポットに固定
 *   ?itinerary=<id>&spot=<id>&day=<n> → しおりから。旅行タイトルと日付はサーバー（page.tsx）が埋める
 *   ?draft=<id>         → 下書きの続き。内容はサーバーが読む
 *   何も無し            → 現在地（画面側で取得。拒否時は東京駅周辺）
 */
export type ComposeSource = "location" | "spot" | "itinerary" | "draft" | "edit" | "current";

export interface ComposeInitialState {
  source: ComposeSource;
  /** 地図の初期中心。null なら画面側で現在地を取る */
  center: { lat: number; lng: number } | null;
  /** 現在地由来か（自宅の保護の判定に使う。spot-selection-v3 Task4） */
  centerFromCurrentLocation: boolean;
  /** 既存スポット（固定）。null なら中央固定ピン */
  spot: RegisteredSpot | null;
  tripTitle: string;
  visitDate: string;
  /** しおりから来たときの識別（投稿後にしおりへ戻る導線などに使う） */
  itineraryId: string | null;
  draftId: string | null;
}

export interface ComposeQuery {
  lat?: string | null;
  lng?: string | null;
  spot?: string | null;
  itinerary?: string | null;
  day?: string | null;
  draft?: string | null;
  /** 現在地から開いたことを示す印（SC-00「いまいる場所に投稿する」・地図の「ここに投稿」が付ける） */
  from?: string | null;
}

export interface ComposeContext {
  /** ?spot= で指定されたスポット（サーバーが引いて渡す） */
  spot?: RegisteredSpot | null;
  /** ?itinerary= の旅行タイトルと Day の日付（サーバーが引いて渡す） */
  itinerary?: { id: string; tripTitle: string; dayDate: string | null } | null;
}

function parseNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function buildComposeInitialState(query: ComposeQuery, context: ComposeContext = {}): ComposeInitialState {
  const today = todayInJst();
  const base: ComposeInitialState = {
    source: "current",
    center: null,
    centerFromCurrentLocation: true,
    spot: null,
    tripTitle: "",
    visitDate: today,
    itineraryId: null,
    draftId: null,
  };

  if (query.draft) {
    return { ...base, source: "draft", draftId: query.draft, centerFromCurrentLocation: false };
  }

  if (query.itinerary && context.itinerary) {
    return {
      ...base,
      source: "itinerary",
      itineraryId: context.itinerary.id,
      spot: context.spot ?? null,
      center: context.spot ? { lat: context.spot.lat, lng: context.spot.lng } : null,
      centerFromCurrentLocation: false,
      tripTitle: context.itinerary.tripTitle,
      // 未定・期間未設定なら今日。未来の Day なら今日（未来日は選べないため）
      visitDate: context.itinerary.dayDate && context.itinerary.dayDate <= today ? context.itinerary.dayDate : today,
    };
  }

  if (query.spot && context.spot) {
    return {
      ...base,
      source: "spot",
      spot: context.spot,
      center: { lat: context.spot.lat, lng: context.spot.lng },
      centerFromCurrentLocation: false,
    };
  }

  const lat = parseNumber(query.lat);
  const lng = parseNumber(query.lng);
  if (lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    return {
      ...base,
      source: "location",
      center: { lat, lng },
      // 長押しなど「利用者が選んだ点」は現在地ではない。from=current のときだけ現在地扱い
      centerFromCurrentLocation: query.from === "current",
    };
  }

  return base;
}

/** 各入口が `/posts/new` を開くときの href（本体は lib/posts/compose-href.ts。post-entry-points Task2） */
export { composeHref } from "./compose-href";
