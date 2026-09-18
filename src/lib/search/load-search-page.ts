import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSearchState, type SearchContext } from "@/components/posts/post-search-query";
import type { SpotSummary } from "@/components/posts/SpotPostListScreen";
import type { AddModeInfo } from "@/components/posts/AddModeBanner";
import { loadAddMode } from "@/lib/itineraries/add-mode";
import { findLatestSpotStatuses, type PostCardPage } from "@/lib/posts/post-cards";
import { parsePostSearchParams, searchPostCards } from "@/lib/posts/search-posts";
import { searchMediaPage, type SpotMediaPage } from "@/lib/posts/search-photos";
import { buildPostSearchParams } from "@/components/posts/post-search-query";
import { resolveDestination, type ResolvedDestination } from "./resolve-destination";

/**
 * post-timeline Task1〜4（v3.0）: /search と /spots/[id] の共通の読み込み
 * 出典: docs/tasks/map-search/post-timeline/01-search-api-destination.md
 *       docs/tasks/map-search/post-timeline/04-spot-list-header-and-add-mode.md
 *
 * 【初心者向け】ページ（Server Component）がやることを 1 か所にまとめた。
 *   1. URL クエリ → 行き先（resolveDestination。q だけなら Geocoding）
 *   2. URL クエリ → 絞り込み・並び替え（parseSearchState）
 *   3. 1 ページ目の投稿（searchPostCards。2 ページ目以降はブラウザが /api/posts/search で取る）
 *   4. スポット別なら見出し用の情報（投稿件数・行きたい保存済みか・最新の「まだあった」）
 *   5. 追加モード（?itinerary=）ならしおりのタイトル
 * `/search?spot=<id>` と `/spots/[id]` は同じ画面なので、どちらのページからも呼ぶ。
 */
export type SearchPageQuery = Record<string, string | string[] | undefined>;

export type SearchPageData =
  | { kind: "spot_missing" }
  | { kind: "error" }
  | {
      kind: "ok";
      resolved: Exclude<ResolvedDestination, { kind: "spot_missing" }>;
      context: SearchContext;
      initialState: ReturnType<typeof parseSearchState>;
      initialPage: PostCardPage;
      /** ?view=photos で開いたときの写真グリッドの 1 ページ目（key は条件の文字列） */
      initialMediaPage: { key: string; page: SpotMediaPage } | null;
      addMode: AddModeInfo | null;
      spot: SpotSummary | null;
    };

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export async function loadSearchPage(admin: SupabaseClient, userId: string, query: SearchPageQuery): Promise<SearchPageData> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") params.set(key, value);
  }

  const resolved = await resolveDestination(admin, {
    spot: str(query.spot),
    pref: str(query.pref),
    lat: str(query.lat),
    lng: str(query.lng),
    q: str(query.q),
  });
  if (resolved.kind === "spot_missing") return { kind: "spot_missing" };

  const addMode = await loadAddMode(admin, userId, { itinerary: str(query.itinerary), day: str(query.day) });
  const context: SearchContext = {
    destination: resolved.destination,
    addMode: addMode ? { itinerary: addMode.itineraryId, day: addMode.day === null ? null : String(addMode.day) } : null,
  };
  const initialState = parseSearchState(params, context);

  try {
    // 座標なしの q は Geocoding 済みの座標に置き換えてから API と同じ関数で読む
    const apiParams = new URLSearchParams(params);
    apiParams.delete("q");
    apiParams.delete("pref");
    apiParams.delete("spot");
    apiParams.delete("lat");
    apiParams.delete("lng");
    if (resolved.destination?.kind === "prefecture") apiParams.set("pref", resolved.destination.name);
    if (resolved.destination?.kind === "spot") apiParams.set("spot", resolved.destination.spotId);
    if (resolved.destination?.kind === "nearby") {
      apiParams.set("lat", String(resolved.destination.lat));
      apiParams.set("lng", String(resolved.destination.lng));
      if (resolved.destination.label) apiParams.set("q", resolved.destination.label);
    }
    if (initialState.keyword) apiParams.set("q", initialState.keyword);

    // 見つからなかった行き先は 0 件（全件を出してしまわない）
    const filters = parsePostSearchParams(apiParams);
    const isPhotos = initialState.view === "photos";
    const initialPage: PostCardPage =
      resolved.kind === "not_found" || isPhotos ? { posts: [], nextOffset: null } : await searchPostCards(admin, userId, filters, 0);
    // 写真切替で開いたときは写真の 1 ページ目を取る（投稿一覧は「投稿」に戻したときにブラウザが取る）
    const initialMediaPage =
      isPhotos && resolved.kind !== "not_found"
        ? { key: buildPostSearchParams({ ...initialState, view: "posts" }, context, 0).toString(), page: await searchMediaPage(admin, userId, filters, 0) }
        : null;

    let spot: SpotSummary | null = null;
    if (resolved.kind === "spot") {
      const [countResult, wishlist, statuses] = await Promise.all([
        admin
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("spot_id", resolved.spot.id)
          .eq("visibility", "public")
          .eq("status", "published")
          .is("hidden_at", null),
        admin.from("wishlist").select("id").eq("user_id", userId).eq("spot_id", resolved.spot.id).maybeSingle(),
        findLatestSpotStatuses(admin, [resolved.spot.id]),
      ]);
      spot = {
        id: resolved.spot.id,
        name: resolved.spot.name,
        prefecture: resolved.spot.prefecture,
        lat: resolved.spot.lat,
        lng: resolved.spot.lng,
        isManualSpot: resolved.spot.source === "manual",
        postCount: countResult.count ?? 0,
        isWishlisted: wishlist.data !== null,
        latestStatus: statuses.get(resolved.spot.id) ?? null,
      };
    }

    return { kind: "ok", resolved, context, initialState, initialPage, initialMediaPage, addMode, spot };
  } catch {
    return { kind: "error" };
  }
}
