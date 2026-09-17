import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAddModeParams, type AddModeInfo } from "@/components/posts/AddModeBanner";

/**
 * add-spots Task2 / post-timeline Task4: 追加モードの情報をサーバーで組み立てる
 * 出典: docs/tasks/itinerary/add-spots/02-add-mode.md
 *       docs/tasks/map-search/post-timeline/04-spot-list-header-and-add-mode.md
 *
 * 【初心者向け】`/search?…&itinerary=<id>&day=<n>` で開かれたとき、バナーに出す旅行タイトルを取る。
 * 自分がメンバーでないしおり（他人の ID を URL に入れた場合）は追加モードにしない（null を返す）。
 * しおりのタイトルは trips.title（しおりはアルバムと旅行タイトルでつながる。3.7.1）。
 */
export async function loadAddMode(
  admin: SupabaseClient,
  userId: string,
  params: { itinerary?: string; day?: string }
): Promise<AddModeInfo | null> {
  const info = parseAddModeParams(params.itinerary ?? null, params.day ?? null);
  if (!info) return null;
  const { data: membership } = await admin
    .from("itinerary_members")
    .select("itinerary_id, itineraries(trips(title))")
    .eq("itinerary_id", info.itineraryId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return null;
  const itinerary = one((membership as { itineraries: unknown }).itineraries) as { trips: unknown } | null;
  const trip = one(itinerary?.trips ?? null) as { title: string } | null;
  return { ...info, title: trip?.title ?? null };
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * add-spots Task2: しおり詳細の「＋ スポットを追加」の行き先
 * しおりのスポットで最も多い都道府県を自動入力して投稿一覧（追加モード）へ。
 * しおりが空（都道府県が分からない）なら検索トップ（/）を追加モードで開き、決定後の一覧に引き継ぐ。
 * 純粋関数（単体テストの対象）
 */
export function addSpotsHref(itineraryId: string, dayIndex: number | null, prefectures: (string | null)[]): string {
  const counts = new Map<string, number>();
  for (const prefecture of prefectures) {
    if (!prefecture) continue;
    counts.set(prefecture, (counts.get(prefecture) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [prefecture, count] of counts) {
    if (count > bestCount) {
      best = prefecture;
      bestCount = count;
    }
  }
  const params = new URLSearchParams();
  if (best) params.set("pref", best);
  params.set("itinerary", itineraryId);
  if (dayIndex !== null) params.set("day", String(dayIndex));
  return `${best ? "/search" : "/"}?${params.toString()}`;
}
