import type { SupabaseClient } from "@supabase/supabase-js";
import { findPrefecture } from "@/lib/geo/prefectures";
import { geocodePlace } from "@/lib/google/geocoding";
import type { SearchContext } from "@/components/posts/post-search-query";

/**
 * post-timeline Task1/Task4（v3.0）: URL クエリ → 行き先（SearchContext.destination）と見出し
 * 出典: docs/tasks/map-search/post-timeline/01-search-api-destination.md
 *       docs/tasks/map-search/search-top/03-submit-and-geocode.md
 *
 * 【初心者向け】/search の URL は 3 通り＋α。
 *   - ?spot=<id>          → スポット別（スポット名が見出し。存在しない・非公開なら null を返して 404）
 *   - ?pref=大阪府         → 都道府県（47 都道府県のどれかでなければ「行き先なし」扱い）
 *   - ?lat&lng&q=大阪駅    → 座標の周辺 5km（q は見出し）
 *   - ?q=大阪駅（座標なし） → 候補から決定せず Enter した場合など。サーバー側で Geocoding して座標にする
 *   - 何も無い             → **みんなの投稿**（全件・新着順。#808。ホームの「みんなの投稿を見る」から開く）
 * ページ（Server Component）から呼ぶ。Geocoding に失敗したら座標なし＝全件にせず、見出しだけ q にして「見つかりませんでした」を出す。
 */
export type ResolvedDestination =
  | { kind: "none"; title: string; destination: null }
  | { kind: "prefecture"; title: string; destination: Extract<SearchContext["destination"], { kind: "prefecture" }> }
  | { kind: "nearby"; title: string; destination: Extract<SearchContext["destination"], { kind: "nearby" }> }
  | {
      kind: "spot";
      title: string;
      destination: Extract<SearchContext["destination"], { kind: "spot" }>;
      spot: { id: string; name: string; prefecture: string | null; lat: number; lng: number; source: string };
    }
  | { kind: "not_found"; title: string; destination: null }
  | { kind: "spot_missing" };

export async function resolveDestination(
  admin: SupabaseClient,
  params: { spot?: string; pref?: string; lat?: string; lng?: string; q?: string },
  geocode: (query: string) => Promise<{ lat: number; lng: number } | null> = geocodePlace
): Promise<ResolvedDestination> {
  const spotId = params.spot?.trim();
  if (spotId) {
    const { data: spot } = await admin
      .from("spots")
      .select("id, name, prefecture, lat, lng, source, hidden_at")
      .eq("id", spotId)
      .maybeSingle();
    // F-AD-05: 非公開化されたスポットは存在しない扱い
    if (!spot || spot.hidden_at) return { kind: "spot_missing" };
    return {
      kind: "spot",
      title: spot.name,
      destination: { kind: "spot", spotId: spot.id },
      spot: { id: spot.id, name: spot.name, prefecture: spot.prefecture, lat: spot.lat, lng: spot.lng, source: spot.source },
    };
  }

  const pref = params.pref?.trim();
  if (pref) {
    const matched = findPrefecture(pref);
    if (matched) return { kind: "prefecture", title: matched.name, destination: { kind: "prefecture", name: matched.name } };
    return { kind: "not_found", title: pref, destination: null };
  }

  const q = params.q?.trim() ?? "";
  const lat = Number(params.lat);
  const lng = Number(params.lng);
  if (params.lat !== undefined && params.lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { kind: "nearby", title: q || "この周辺", destination: { kind: "nearby", lat, lng, label: q || null } };
  }

  if (q) {
    try {
      const place = await geocode(q);
      if (place) return { kind: "nearby", title: q, destination: { kind: "nearby", lat: place.lat, lng: place.lng, label: q } };
    } catch {
      // Geocoding の障害は「見つからない」と同じ扱い
    }
    return { kind: "not_found", title: q, destination: null };
  }

  // #808（2026-10-06）: 行き先なし＝「みんなの投稿」（要件 3.4.2）。
  // 「全国」「全て」のような**範囲を示す言葉は出さない**（海外に出しても文言を変えなくて済む）。
  // 地図の凡例で既に使っている言葉に合わせた。
  return { kind: "none", title: "みんなの投稿", destination: null };
}
