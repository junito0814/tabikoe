import type { DestinationSuggestion } from "@/lib/search/suggest-destinations";

/**
 * 出典: #699（Google の候補一覧に「Google マップ」の表記が無い）
 * 要件定義書 6.2「Google から借りるものの方針」・4.5.14
 * [Policies and attributions for Places API](https://developers.google.com/maps/documentation/places/web-service/policies)
 *
 * **候補の「出どころ」を決める判断**をここにまとめる（約束 13）。
 *
 * 【初心者向け】Google の規約は、Places のデータを**地図の無い画面**に出すとき
 * 「Google マップ」の表記を見える位置に出すことと、**どれが Google 由来か分かること**を
 * 求めている。いまの候補一覧は Google 由来（駅・市区町村）とタビコエ由来
 * （登録済みスポット・都道府県）が**混ざっていて**、どちらも区別できなかった。
 *
 * 画面ではなくここで判断するのは、同じ決まりを 2 つの画面
 * （行き先の候補・投稿画面のスポット候補）で使うため。
 */
export type AttributionSource = "tabikoe" | "google";

/** 一覧の見出し。Google 由来のほうは「Google マップ」の表記そのものにもなっている */
export const ATTRIBUTION_SOURCE_LABELS: Record<AttributionSource, string> = {
  tabikoe: "タビコエの中から",
  google: "Google マップから",
};

/** 行き先の候補（SC-00）。駅・市区町村は Places Autocomplete から来る */
export function destinationSuggestionSource(kind: DestinationSuggestion["kind"]): AttributionSource {
  return kind === "station" || kind === "locality" ? "google" : "tabikoe";
}

/**
 * 投稿画面のスポット候補（SC-03）。
 * `id` があるものは既にタビコエに登録済み、無いものは Google 由来の未登録。
 */
export function spotCandidateSource(candidate: { id: string | null }): AttributionSource {
  return candidate.id === null ? "google" : "tabikoe";
}

/**
 * 出どころごとにまとめる。**タビコエが先、Google が後。** 空の組は返さない。
 * 組の中の並びは元のまま（API が返した順＝近い・それらしい順を崩さない）。
 */
export function groupBySource<T>(
  items: readonly T[],
  sourceOf: (item: T) => AttributionSource
): { source: AttributionSource; items: T[] }[] {
  const groups: { source: AttributionSource; items: T[] }[] = [];
  for (const source of ["tabikoe", "google"] as const) {
    const matched = items.filter((item) => sourceOf(item) === source);
    if (matched.length > 0) groups.push({ source, items: matched });
  }
  return groups;
}
