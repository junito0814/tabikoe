import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSearchState, type SearchContext } from "@/components/posts/post-search-query";
import type { SpotSummary } from "@/components/posts/SpotPostListScreen";
import type { AddModeInfo } from "@/components/posts/AddModeBanner";
import { loadAddMode } from "@/lib/itineraries/add-mode";
import { findLatestSpotStatuses, type PostCardPage } from "@/lib/posts/post-cards";
import { parsePostSearchParams, searchPostCards } from "@/lib/posts/search-posts";
import { parseSpotSort, searchSpotCards, type SpotCardPage } from "@/lib/spots/search-spots";
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
      /** スポット別（spot）のときの投稿カードの 1 ページ目。検索結果（prefecture／nearby）では空 */
      initialPage: PostCardPage;
      /** v3.1: 検索結果（prefecture／nearby）のときのスポットカードの 1 ページ目。スポット別では空 */
      initialSpotPage: SpotCardPage;
      /** ?view=photos で開いたときの写真グリッドの 1 ページ目（key は条件の文字列） */
      initialMediaPage: { key: string; page: SpotMediaPage } | null;
      addMode: AddModeInfo | null;
      spot: SpotSummary | null;
    };

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** スポット別一覧の見出し（件数・行きたい・最新の報告）。3 本のクエリを並列に */
async function loadSpotSummary(admin: SupabaseClient, userId: string, spot: { id: string; name: string; prefecture: string | null; lat: number | null; lng: number | null; source: string }): Promise<SpotSummary> {
  const [countResult, wishlist, statuses] = await Promise.all([
    admin.from("posts").select("id", { count: "exact", head: true }).eq("spot_id", spot.id).eq("visibility", "public").eq("status", "published").is("hidden_at", null),
    admin.from("wishlist").select("id").eq("user_id", userId).eq("spot_id", spot.id).maybeSingle(),
    findLatestSpotStatuses(admin, [spot.id]),
  ]);
  return {
    id: spot.id,
    name: spot.name,
    prefecture: spot.prefecture,
    lat: spot.lat,
    lng: spot.lng,
    isManualSpot: spot.source === "manual",
    postCount: countResult.count ?? 0,
    isWishlisted: wishlist.data !== null,
    latestStatus: statuses.get(spot.id) ?? null,
  };
}

/** 1 ページ目のまとまり（投稿カード／スポットカード／写真）。ストリーミングではこれだけを後から流す */
export interface SearchFirstPage {
  initialPage: PostCardPage;
  initialSpotPage: SpotCardPage;
  initialMediaPage: { key: string; page: SpotMediaPage } | null;
}

/** 1 ページ目を待たずに出せる部分（見出し・地図・条件）。performance Task2 */
export type SearchPageShell =
  | { kind: "spot_missing" }
  | { kind: "error" }
  | {
      kind: "ok";
      resolved: Exclude<ResolvedDestination, { kind: "spot_missing" }>;
      context: SearchContext;
      initialState: ReturnType<typeof parseSearchState>;
      addMode: AddModeInfo | null;
      spot: SpotSummary | null;
      /** 1 ページ目を取るための条件（loadSearchFirstPage に渡す） */
      firstPageInput: { filters: ReturnType<typeof parsePostSearchParams>; spotSort: ReturnType<typeof parseSpotSort>; isPhotos: boolean; isSpotResult: boolean; empty: boolean; notFound: boolean };
    };

/**
 * performance Task2（2026-09-22）: 読み込みを「骨組み（速い）」と「1 ページ目（遅い）」に分ける。
 * 【初心者向け】ページはまず骨組み（行き先・スポットの見出し・条件）だけを待って HTML を返し始め、
 * 1 ページ目は Promise のままブラウザ側の Suspense に渡す。データが揃った順に画面が埋まる。
 */
export async function loadSearchShell(admin: SupabaseClient, userId: string, query: SearchPageQuery): Promise<SearchPageShell> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") params.set(key, value);
  }

  try {
    // performance Task1: 行き先の解決と追加モードの読み込みは独立なので並列に（往復 1 回分を節約）
    const [resolved, addMode] = await Promise.all([
      resolveDestination(admin, {
        spot: str(query.spot),
        pref: str(query.pref),
        lat: str(query.lat),
        lng: str(query.lng),
        q: str(query.q),
      }),
      loadAddMode(admin, userId, { itinerary: str(query.itinerary), day: str(query.day) }),
    ]);
    if (resolved.kind === "spot_missing") return { kind: "spot_missing" };

    const context: SearchContext = {
      destination: resolved.destination,
      addMode: addMode ? { itinerary: addMode.itineraryId, day: addMode.day === null ? null : String(addMode.day) } : null,
    };
    const initialState = parseSearchState(params, context);

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
    // v3.1: 検索結果（都道府県・駅）はスポット単位、スポット別は投稿単位で 1 ページ目を取る
    const isSpotResult = resolved.kind !== "spot";
    const empty = resolved.kind === "not_found" || isPhotos;
    const spot = resolved.kind === "spot" ? await loadSpotSummary(admin, userId, resolved.spot) : null;

    return {
      kind: "ok",
      resolved,
      context,
      initialState,
      addMode,
      spot,
      firstPageInput: { filters, spotSort: parseSpotSort(apiParams.get("sort")), isPhotos, isSpotResult, empty, notFound: resolved.kind === "not_found" },
    };
  } catch {
    return { kind: "error" };
  }
}

/** 1 ページ目（投稿／スポット／写真）。3 つは独立なので並列に。失敗は呼び出し側で扱う */
export async function loadSearchFirstPage(admin: SupabaseClient, userId: string, shell: Extract<SearchPageShell, { kind: "ok" }>): Promise<SearchFirstPage> {
  const { filters, spotSort, isPhotos, isSpotResult, empty, notFound } = shell.firstPageInput;
  const [initialPage, initialSpotPage, mediaPage] = await Promise.all([
    empty || isSpotResult ? Promise.resolve<PostCardPage>({ posts: [], nextOffset: null }) : searchPostCards(admin, userId, filters, 0),
    empty || !isSpotResult ? Promise.resolve<SpotCardPage>({ spots: [], nextOffset: null }) : searchSpotCards(admin, userId, filters, spotSort, 0),
    // 写真切替で開いたときは写真の 1 ページ目を取る（投稿一覧は「投稿」に戻したときにブラウザが取る）
    isPhotos && !notFound ? searchMediaPage(admin, userId, filters, 0, undefined, spotSort) : Promise.resolve(null),
  ]);
  const initialMediaPage = mediaPage ? { key: buildPostSearchParams({ ...shell.initialState, view: "posts" }, shell.context, 0).toString(), page: mediaPage } : null;
  return { initialPage, initialSpotPage, initialMediaPage };
}

/**
 * サーバーで 1 ページ目が取れなかったときにブラウザへ渡す「空で、すぐ取り直す」ページ。
 * 【初心者向け】nextOffset を 0 にしておくと、画面側の無限スクロールが「まだ 1 ページ目が無い」と判断して
 * /api から取り直す。取り直しも失敗すれば画面側のエラー表示（再試行つき）が出る。
 */
export function retryableEmptyFirstPage(shell: Extract<SearchPageShell, { kind: "ok" }>): SearchFirstPage {
  const { isSpotResult, empty } = shell.firstPageInput;
  return {
    initialPage: { posts: [], nextOffset: empty || isSpotResult ? null : 0 },
    initialSpotPage: { spots: [], nextOffset: empty || !isSpotResult ? null : 0 },
    initialMediaPage: null,
  };
}

/** 骨組みと 1 ページ目をまとめて待つ（従来どおりの形。/spots/[id]・テストで使う） */
export async function loadSearchPage(admin: SupabaseClient, userId: string, query: SearchPageQuery): Promise<SearchPageData> {
  const shell = await loadSearchShell(admin, userId, query);
  if (shell.kind !== "ok") return shell;
  try {
    const first = await loadSearchFirstPage(admin, userId, shell);
    return { kind: "ok", resolved: shell.resolved, context: shell.context, initialState: shell.initialState, addMode: shell.addMode, spot: shell.spot, ...first };
  } catch {
    return { kind: "error" };
  }
}
