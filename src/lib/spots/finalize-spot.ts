import type { SupabaseClient } from "@supabase/supabase-js";
import { reverseGeocodePrefecture } from "@/lib/google/geocoding";
import { graphemeLength } from "@/lib/text/grapheme-length";
import { DUPLICATE_SPOT_RADIUS_METERS, findNearbySpots } from "./nearby";
import type { RegisteredSpot } from "./types";

/** スポット名の最大文字数（要件定義書3.3.1） */
export const MAX_SPOT_NAME_LENGTH = 200;
/** 名前を入れずに「新しい場所」として投稿したときのスポット名（要件定義書 v3.0 3.3.5） */
export const UNNAMED_SPOT_NAME = "名前のない場所";

export type FinalizeSpotInput =
  | { spotId: string; lat?: undefined; lng?: undefined; name?: undefined }
  | { spotId?: null; lat: number; lng: number; name?: string | null };

export type FinalizeSpotResult =
  | { ok: true; spot: RegisteredSpot; created: boolean }
  | { ok: false; error: "spot_not_found" | "invalid_name" | "insert_failed" | "nearby_lookup_failed" };

/**
 * spot-selection-v3 Task3: 投稿時のスポット確定（新規登録・重複判定・都道府県）
 * 出典: docs/tasks/posts/spot-selection-v3/03-spot-finalize-on-publish.md
 *       要件定義書 v3.0 3.3.5
 *
 * 【初心者向け】投稿を公開するとき、スポットは次の 3 通りで決まる。
 *   1. 既存スポットが選ばれている（spotId あり）→ そのまま使う
 *   2. 位置だけ（「この場所（新しい場所）」）→ 半径 50m 以内に既存があれば**サーバー側で再判定して**それに寄せる
 *   3. 近くに無ければ、ピンの位置に手動登録スポット（source='manual'＝「タビコエだけの場所」）を作り、
 *      都道府県を逆ジオコーディングで入れる
 * ブラウザ側でも 50m 判定はしているが、投稿の瞬間に別の人が登録している可能性があるので、ここでもう一度確かめる。
 * 下書きはこの関数を呼ばない（スポットを作らない）。
 */
export async function finalizeSpotForPost(admin: SupabaseClient, input: FinalizeSpotInput): Promise<FinalizeSpotResult> {
  if ("spotId" in input && input.spotId) {
    const { data: spot } = await admin
      .from("spots")
      .select("id, name, lat, lng, prefecture, source")
      .eq("id", input.spotId)
      .maybeSingle();
    if (!spot) return { ok: false, error: "spot_not_found" };
    return { ok: true, spot: spot as RegisteredSpot, created: false };
  }

  const lat = input.lat as number;
  const lng = input.lng as number;
  const name = (input.name ?? "").trim() || UNNAMED_SPOT_NAME;
  if (graphemeLength(name) > MAX_SPOT_NAME_LENGTH) {
    return { ok: false, error: "invalid_name" };
  }

  let nearby;
  try {
    nearby = await findNearbySpots(admin, lat, lng, DUPLICATE_SPOT_RADIUS_METERS);
  } catch {
    return { ok: false, error: "nearby_lookup_failed" };
  }
  if (nearby.length > 0) {
    const existing = nearby[0];
    return {
      ok: true,
      created: false,
      spot: { id: existing.id, name: existing.name, lat: existing.lat, lng: existing.lng, prefecture: existing.prefecture, source: existing.source },
    };
  }

  const { data: inserted, error: insertError } = await admin
    .from("spots")
    .insert({ name, lat, lng, source: "manual" })
    .select("id, name, lat, lng, prefecture, source")
    .single();
  if (insertError || !inserted) {
    return { ok: false, error: "insert_failed" };
  }

  // 都道府県を一度だけ確定させる。判定できなくてもスポット登録自体は成立させる
  let spot = inserted as RegisteredSpot;
  try {
    const prefecture = await reverseGeocodePrefecture(lat, lng);
    if (prefecture) {
      const { data: updated } = await admin
        .from("spots")
        .update({ prefecture })
        .eq("id", inserted.id)
        .select("id, name, lat, lng, prefecture, source")
        .single();
      if (updated) spot = updated as RegisteredSpot;
    }
  } catch {
    // Geocoding APIの障害は登録失敗にしない
  }
  return { ok: true, spot, created: true };
}
