import type { SupabaseClient } from "@supabase/supabase-js";
import { autocompleteRegions, PlacesApiError } from "@/lib/google/places";
import { matchPrefectures } from "@/lib/geo/prefectures";

/**
 * search-top Task1: 行き先候補（都道府県 → 駅・市区町村 → 登録済みスポット）
 * 出典: docs/tasks/map-search/search-top/01-suggest-api.md
 *       要件定義書 v3.0 3.4.1「候補表示」
 *
 * 【初心者向け】3 つの候補源をこの順で合わせて最大 8 件にする。
 *   1. 都道府県: アプリ内の固定リスト（API を呼ばない）
 *   2. 駅・市区町村: Google Places Autocomplete（2 文字以上のときだけ。呼び出し回数を抑える）
 *   3. 登録済みスポット: spots テーブルの名前の部分一致（投稿数が多い順）
 * Places が落ちていても 1 と 3 は返す（エラーにしない）。
 */
export const MAX_DESTINATION_SUGGESTIONS = 8;
const MIN_QUERY_LENGTH_FOR_PLACES = 2;

export type DestinationSuggestion =
  | { kind: "prefecture"; name: string; lat: number; lng: number }
  | { kind: "station" | "locality"; name: string; secondaryText: string | null; placeId: string }
  | { kind: "spot"; name: string; spotId: string; prefecture: string | null };

export async function suggestDestinations(
  admin: SupabaseClient,
  query: string,
  options: { sessionToken?: string | null; placesEnabled?: boolean } = {}
): Promise<{ suggestions: DestinationSuggestion[]; placesUnavailable: boolean }> {
  const q = query.trim();
  if (!q) return { suggestions: [], placesUnavailable: false };

  const prefectures: DestinationSuggestion[] = matchPrefectures(q, 3).map((p) => ({ kind: "prefecture", name: p.name, lat: p.lat, lng: p.lng }));

  let regions: DestinationSuggestion[] = [];
  let placesUnavailable = false;
  if ((options.placesEnabled ?? true) && q.length >= MIN_QUERY_LENGTH_FOR_PLACES) {
    try {
      regions = (await autocompleteRegions(q, options.sessionToken ?? null, 4)).map((r) => ({
        kind: r.kind,
        name: r.name,
        secondaryText: r.secondaryText,
        placeId: r.placeId,
      }));
    } catch (error) {
      if (!(error instanceof PlacesApiError)) throw error;
      placesUnavailable = true;
    }
  }

  const escaped = q.replace(/[\\%_]/g, (char) => `\\${char}`);
  const { data } = await admin
    .from("spots")
    .select("id, name, prefecture, posts(count)")
    .ilike("name", `%${escaped}%`)
    .is("hidden_at", null)
    .limit(8);
  type SpotRow = { id: string; name: string; prefecture: string | null; posts: { count: number }[] };
  const spots: DestinationSuggestion[] = ((data ?? []) as unknown as SpotRow[])
    .sort((a, b) => (b.posts?.[0]?.count ?? 0) - (a.posts?.[0]?.count ?? 0))
    .map((s) => ({ kind: "spot", name: s.name, spotId: s.id, prefecture: s.prefecture }));

  return { suggestions: mergeSuggestions(prefectures, regions, spots), placesUnavailable };
}

/** 都道府県 → 駅・市区町村 → スポットの順で、名前の重複を除いて最大件数に収める（単体テストの対象） */
export function mergeSuggestions(...groups: DestinationSuggestion[][]): DestinationSuggestion[] {
  const seen = new Set<string>();
  const merged: DestinationSuggestion[] = [];
  for (const group of groups) {
    for (const item of group) {
      const key = `${item.kind}:${item.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
      if (merged.length >= MAX_DESTINATION_SUGGESTIONS) return merged;
    }
  }
  return merged;
}

/** 候補の種別ラベル（画面表示用） */
export const SUGGESTION_KIND_LABELS: Record<DestinationSuggestion["kind"], string> = {
  prefecture: "都道府県",
  station: "駅",
  locality: "市区町村",
  spot: "スポット",
};
