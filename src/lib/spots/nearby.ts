import type { PostCategory } from "@/lib/posts/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 重複登録防止の判定半径（要件定義書3.3.5） */
export const DUPLICATE_SPOT_RADIUS_METERS = 50;

export interface NearbySpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  prefecture: string | null;
  source: "places" | "manual";
  distance_meters: number;
  /** #865: そのスポットの代表カテゴリ（/api/spots/resolve が付ける。近傍検索そのものは付けない） */
  category?: PostCategory | null;
}

/**
 * F-PO-01 スポット指定 Task1: 近傍検索の共通呼び出し
 * 出典: docs/tasks/posts/spot-selection/01-spots-geo-search-index.md
 *
 * public.find_nearby_spots()（矩形での絞り込み＋Haversine）を呼ぶ薄いラッパー。
 * 重複登録防止（Task5）と候補検索（Task2）の双方から利用する。
 */
export async function findNearbySpots(
  supabase: SupabaseClient,
  lat: number,
  lng: number,
  radiusMeters: number = DUPLICATE_SPOT_RADIUS_METERS
): Promise<NearbySpot[]> {
  const { data, error } = await supabase.rpc("find_nearby_spots", {
    p_lat: lat,
    p_lng: lng,
    p_radius_meters: radiusMeters,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as NearbySpot[];
}
