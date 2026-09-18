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
