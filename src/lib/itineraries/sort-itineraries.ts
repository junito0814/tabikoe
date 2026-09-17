import { isPeriodPast } from "./day-utils";

/**
 * itinerary-basics Task2: しおり一覧の並び順
 * 出典: docs/tasks/itinerary/itinerary-basics/02-itinerary-list-screen.md
 *       要件定義書 v3.0 3.11.1
 *
 * 【初心者向け】3 つのグループに分けて並べる。
 *   1. これからの旅行（期間あり・終了日が今日以降）: 開始日が近い順
 *   2. 期間未設定: 更新日時が新しい順
 *   3. 終わった旅行（終了日が今日より前）: 終了日が新しい順。末尾に薄く出し「アルバムを見る」
 */
export interface SortableItinerary {
  startDate: string | null;
  endDate: string | null;
  updatedAt: string;
}

export type ItineraryGroup = "upcoming" | "undated" | "past";

export function itineraryGroup(item: SortableItinerary, today: string): ItineraryGroup {
  if (!item.startDate || !item.endDate) return "undated";
  return isPeriodPast(item.endDate, today) ? "past" : "upcoming";
}

export function sortItineraries<T extends SortableItinerary>(items: T[], today: string): T[] {
  const rank: Record<ItineraryGroup, number> = { upcoming: 0, undated: 1, past: 2 };
  return [...items].sort((a, b) => {
    const ga = itineraryGroup(a, today);
    const gb = itineraryGroup(b, today);
    if (ga !== gb) return rank[ga] - rank[gb];
    if (ga === "upcoming") return (a.startDate as string).localeCompare(b.startDate as string);
    if (ga === "past") return (b.endDate as string).localeCompare(a.endDate as string);
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
