import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_MAP_PINS, type MapBounds } from "./get-map-pins";
import { UNNAMED_SPOT_NAME } from "@/lib/spots/finalize-spot";
import { resolveSpotCategory } from "./spot-category";
import type { PostCategory } from "@/lib/posts/constants";

/**
 * F-RC-06 Task1: マイマップ用ピンデータ
 * 出典: docs/tasks/records/my-map/01-my-map-pin-data-handler.md
 *       要件定義書3.6.5
 *
 * 【初心者向け】DB から「自分の投稿があるスポット」「保存済み（行きたい＋自分がメンバーのしおり）」「下書き」を
 * 別々に取り（Promise.all で同時に）、`mergeMyMapPins` で 1 つの配列に合体させる。合体のルール（両方該当は posted、
 * 下書きは常に、最大 100 件）は純粋関数にして単体テストしやすくしてある。
 * `spots!inner(...)` は「spots を結合し、範囲外のものは除く」という PostgREST の書き方。
 * v3.0（my-map-v3 Task1）: 「行きたい」の切替を「保存済み」（saved）に広げ、下書きを加えた。
 */
/** 切替: posted＝自分の投稿のみ、saved＝保存済みのみ、both＝両方。下書きは切替に関わらず常に出す（v3.0） */
export type MyMapMode = "posted" | "saved" | "both";

export function parseMyMapMode(value: string | null): MyMapMode {
  // v1 の "wishlist" は "saved" として読む（古いリンク対策）
  if (value === "wishlist") return "saved";
  return value === "posted" || value === "saved" ? value : "both";
}

export interface MyMapPin {
  /** ピンの識別子。スポットは spotId、下書きは `draft:<postId>` */
  id: string;
  spotId: string | null;
  name: string;
  lat: number;
  lng: number;
  /** 投稿済み（保存済みにも該当する場合は posted。3.6.5）／保存済み（行きたい＋しおり）／下書き */
  kind: "posted" | "saved" | "draft";
  /** 投稿済みピンの遷移先（自分の最新の投稿）。下書きでは下書きの投稿 ID */
  latestPostId: string | null;
  /**
   * pin-categories Task2: ピンの色と記号を決めるカテゴリ（4.5.3）。
   * SC-02 と同じ見た目にするため、**そのスポットの公開投稿全体**から決める（自分の投稿だけではない）。
   */
  category: PostCategory | null;
  isWishlisted: boolean;
}

interface SpotRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface MyMapDraft {
  id: string;
  lat: number;
  lng: number;
  spot: SpotRow | null;
}

/**
 * 投稿済み・保存済み・下書きの 3 系統を統合する（単体テストの対象）。
 * 投稿済みと保存済みの両方に該当するスポットは 1 件にまとめ、種別は posted（保存自体は保持される）。
 * 下書きは切替に関わらず常に含める（自分にしか見えない）。最大 100 件で打ち切る。
 */
export function mergeMyMapPins(
  posted: { spot: SpotRow; latestPostId: string }[],
  saved: { spot: SpotRow }[],
  mode: MyMapMode,
  drafts: MyMapDraft[] = [],
  limit: number = MAX_MAP_PINS,
  /** スポット ID → カテゴリ（pin-categories Task2。無ければ灰色のピンになる） */
  categoryBySpot: ReadonlyMap<string, PostCategory> = new Map()
): MyMapPin[] {
  const pins = new Map<string, MyMapPin>();

  if (mode !== "saved") {
    for (const item of posted) {
      if (pins.has(item.spot.id)) continue;
      pins.set(item.spot.id, {
        id: item.spot.id,
        spotId: item.spot.id,
        name: item.spot.name,
        lat: item.spot.lat,
        lng: item.spot.lng,
        kind: "posted",
        latestPostId: item.latestPostId,
        category: categoryBySpot.get(item.spot.id) ?? null,
        isWishlisted: false,
      });
    }
  }

  if (mode !== "posted") {
    for (const item of saved) {
      const existing = pins.get(item.spot.id);
      if (existing) {
        existing.isWishlisted = true;
        continue;
      }
      pins.set(item.spot.id, {
        id: item.spot.id,
        spotId: item.spot.id,
        name: item.spot.name,
        lat: item.spot.lat,
        lng: item.spot.lng,
        kind: "saved",
        latestPostId: null,
        category: categoryBySpot.get(item.spot.id) ?? null,
        isWishlisted: true,
      });
    }
  }

  for (const draft of drafts) {
    pins.set(`draft:${draft.id}`, {
      id: `draft:${draft.id}`,
      spotId: draft.spot?.id ?? null,
      name: draft.spot?.name ?? UNNAMED_SPOT_NAME,
      lat: draft.lat,
      lng: draft.lng,
      kind: "draft",
      latestPostId: draft.id,
      // 下書きはまだカテゴリが決まっていない
      category: null,
      isWishlisted: false,
    });
  }

  return Array.from(pins.values()).slice(0, limit);
}

/** 範囲内の、本人の投稿があるスポット（非公開含む）・保存済み（行きたい＋しおり）・下書き */
export async function getMyMapPins(
  admin: SupabaseClient,
  userId: string,
  mode: MyMapMode,
  bounds: MapBounds
): Promise<MyMapPin[]> {
  const inBounds = <Q>(query: Q, prefix: string): Q => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = query as any;
    return q.gte(`${prefix}lat`, bounds.south).lte(`${prefix}lat`, bounds.north).gte(`${prefix}lng`, bounds.west).lte(`${prefix}lng`, bounds.east) as Q;
  };
  const empty = Promise.resolve({ data: [], error: null });

  const { data: memberships } = mode === "posted" ? { data: [] } : await admin.from("itinerary_members").select("itinerary_id").eq("user_id", userId);
  const itineraryIds = ((memberships ?? []) as { itinerary_id: string }[]).map((row) => row.itinerary_id);

  const [postedResult, wishlistResult, itineraryResult, draftResult] = await Promise.all([
    mode === "saved"
      ? empty
      : inBounds(admin.from("posts").select("id, created_at, spot:spots!inner(id, name, lat, lng)").eq("user_id", userId).eq("status", "published"), "spots.")
          .order("created_at", { ascending: false })
          .limit(MAX_MAP_PINS * 5),
    mode === "posted"
      ? empty
      : inBounds(admin.from("wishlist").select("spot:spots!inner(id, name, lat, lng)").eq("user_id", userId), "spots.")
          .order("created_at", { ascending: false })
          .limit(MAX_MAP_PINS),
    mode === "posted" || itineraryIds.length === 0
      ? empty
      : inBounds(admin.from("itinerary_spots").select("spot:spots!inner(id, name, lat, lng)").in("itinerary_id", itineraryIds), "spots.").limit(MAX_MAP_PINS),
    // 下書き（本人のみ・常に）
    inBounds(admin.from("posts").select("id, lat, lng, spot:spots(id, name, lat, lng)").eq("user_id", userId).eq("status", "draft").not("lat", "is", null).not("lng", "is", null), "").limit(
      MAX_MAP_PINS
    ),
  ]);
  for (const result of [postedResult, wishlistResult, itineraryResult, draftResult]) {
    if (result.error) throw result.error;
  }

  const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? (value[0] ?? null) : value);
  const posted = ((postedResult.data ?? []) as unknown as { id: string; spot: SpotRow | SpotRow[] | null }[]).flatMap((row) => {
    const spot = one(row.spot);
    return spot ? [{ spot, latestPostId: row.id }] : [];
  });
  const saved = [...((wishlistResult.data ?? []) as unknown as { spot: SpotRow | SpotRow[] | null }[]), ...((itineraryResult.data ?? []) as unknown as { spot: SpotRow | SpotRow[] | null }[])].flatMap(
    (row) => {
      const spot = one(row.spot);
      return spot ? [{ spot }] : [];
    }
  );
  const drafts = ((draftResult.data ?? []) as unknown as { id: string; lat: number; lng: number; spot: SpotRow | SpotRow[] | null }[]).map((row) => ({
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    spot: one(row.spot),
  }));

  // pin-categories Task2: ピンの色を SC-02 と揃えるため、集めたスポットの「公開投稿のカテゴリ」を取る。
  // あしあとの取得は「自分の投稿」「保存済み」から引いているので、公開投稿の情報はここにしか無い（1 本だけ足す）
  const spotIds = Array.from(new Set([...posted.map((row) => row.spot.id), ...saved.map((row) => row.spot.id)]));
  const categoryBySpot = await findSpotCategories(admin, spotIds);

  return mergeMyMapPins(posted, saved, mode, drafts, MAX_MAP_PINS, categoryBySpot);
}

/** スポットごとの「公開投稿から決めたカテゴリ」（4.5.3。いちばん多いカテゴリ、同数なら新しい方） */
async function findSpotCategories(admin: SupabaseClient, spotIds: string[]): Promise<Map<string, PostCategory>> {
  const map = new Map<string, PostCategory>();
  if (spotIds.length === 0) return map;
  const { data, error } = await admin
    .from("posts")
    .select("spot_id, category, created_at")
    .in("spot_id", spotIds)
    .eq("visibility", "public")
    .eq("status", "published")
    .is("hidden_at", null);
  if (error) throw error;

  const grouped = new Map<string, { category: string | null; createdAt: string | null }[]>();
  for (const row of (data ?? []) as { spot_id: string; category: string | null; created_at: string | null }[]) {
    const list = grouped.get(row.spot_id) ?? [];
    list.push({ category: row.category, createdAt: row.created_at });
    grouped.set(row.spot_id, list);
  }
  for (const [spotId, posts] of grouped) {
    const category = resolveSpotCategory(posts);
    if (category) map.set(spotId, category);
  }
  return map;
}
