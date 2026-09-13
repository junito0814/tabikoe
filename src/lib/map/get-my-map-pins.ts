import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_MAP_PINS, type MapBounds } from "./get-map-pins";

/**
 * F-RC-06 Task1: マイマップ用ピンデータ
 * 出典: docs/tasks/records/my-map/01-my-map-pin-data-handler.md
 *       要件定義書3.6.5
 */
export type MyMapMode = "posted" | "wishlist" | "both";

export function parseMyMapMode(value: string | null): MyMapMode {
  return value === "posted" || value === "wishlist" ? value : "both";
}

export interface MyMapPin {
  spotId: string;
  name: string;
  lat: number;
  lng: number;
  /** 投稿済み（行きたいにも該当する場合は posted。3.6.5） */
  kind: "posted" | "wishlist";
  /** 投稿済みピンの遷移先（自分の最新の投稿）。wishlist では null */
  latestPostId: string | null;
  isWishlisted: boolean;
}

interface SpotRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/**
 * 投稿済み・行きたいの2系統を統合する（単体テストの対象）。
 * 両方に該当するスポットは1件にまとめ、種別は posted（「行きたい」登録自体は保持される）。
 * 最大100件で打ち切る。
 */
export function mergeMyMapPins(
  posted: { spot: SpotRow; latestPostId: string }[],
  wishlisted: { spot: SpotRow }[],
  mode: MyMapMode,
  limit: number = MAX_MAP_PINS
): MyMapPin[] {
  const pins = new Map<string, MyMapPin>();

  if (mode !== "wishlist") {
    for (const item of posted) {
      if (pins.has(item.spot.id)) continue;
      pins.set(item.spot.id, {
        spotId: item.spot.id,
        name: item.spot.name,
        lat: item.spot.lat,
        lng: item.spot.lng,
        kind: "posted",
        latestPostId: item.latestPostId,
        isWishlisted: false,
      });
    }
  }

  if (mode !== "posted") {
    for (const item of wishlisted) {
      const existing = pins.get(item.spot.id);
      if (existing) {
        existing.isWishlisted = true;
        continue;
      }
      pins.set(item.spot.id, {
        spotId: item.spot.id,
        name: item.spot.name,
        lat: item.spot.lat,
        lng: item.spot.lng,
        kind: "wishlist",
        latestPostId: null,
        isWishlisted: true,
      });
    }
  }

  return Array.from(pins.values()).slice(0, limit);
}

/** 範囲内の、本人の投稿があるスポット（非公開含む）と「行きたい」スポット */
export async function getMyMapPins(
  admin: SupabaseClient,
  userId: string,
  mode: MyMapMode,
  bounds: MapBounds
): Promise<MyMapPin[]> {
  const [postedResult, wishlistResult] = await Promise.all([
    mode === "wishlist"
      ? Promise.resolve({ data: [], error: null })
      : admin
          .from("posts")
          .select("id, created_at, spot:spots!inner(id, name, lat, lng)")
          .eq("user_id", userId)
          .gte("spots.lat", bounds.south)
          .lte("spots.lat", bounds.north)
          .gte("spots.lng", bounds.west)
          .lte("spots.lng", bounds.east)
          .order("created_at", { ascending: false })
          .limit(MAX_MAP_PINS * 5),
    mode === "posted"
      ? Promise.resolve({ data: [], error: null })
      : admin
          .from("wishlist")
          .select("spot:spots!inner(id, name, lat, lng)")
          .eq("user_id", userId)
          .gte("spots.lat", bounds.south)
          .lte("spots.lat", bounds.north)
          .gte("spots.lng", bounds.west)
          .lte("spots.lng", bounds.east)
          .order("created_at", { ascending: false })
          .limit(MAX_MAP_PINS),
  ]);
  if (postedResult.error) throw postedResult.error;
  if (wishlistResult.error) throw wishlistResult.error;

  const posted = ((postedResult.data ?? []) as unknown as { id: string; spot: SpotRow | null }[]).flatMap(
    (row) => (row.spot ? [{ spot: row.spot, latestPostId: row.id }] : [])
  );
  const wishlisted = ((wishlistResult.data ?? []) as unknown as { spot: SpotRow | null }[]).flatMap((row) =>
    row.spot ? [{ spot: row.spot }] : []
  );

  return mergeMyMapPins(posted, wishlisted, mode);
}
