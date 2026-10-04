import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { graphemeLength } from "@/lib/text/grapheme-length";
import { DUPLICATE_SPOT_RADIUS_METERS, findNearbySpots } from "@/lib/spots/nearby";
import { reverseGeocodePrefecture } from "@/lib/google/geocoding";
import { getMapPins, parseMapBounds } from "@/lib/map/get-map-pins";
import { parseSpotFilters } from "@/lib/map/spot-aggregate";
import { findPrefecture } from "@/lib/geo/prefectures";

/** スポット名の最大文字数（要件定義書3.3.1） */
const MAX_SPOT_NAME_LENGTH = 200;

/**
 * F-MP-01 Task1 / map-display-v3 Task1（v3.0）: 全体マップ（SC-02）のピン取得
 * 出典: docs/tasks/map-search/map-display/01-spots-fetch-handler.md
 *       docs/tasks/map-search/map-display-v3/01-pins-api-kinds.md
 *
 * 指定範囲（north/south/east/west、度）内の ①公開投稿があるスポット ②自分の行きたい＋しおりのスポット
 * ③自分の下書き を 1 回で返す。各ピンに `kind`（post／saved／draft）が付き、saved が post より優先。最大 100 件。
 * v1 の `view=all|wishlist` タブは廃止（タブは無くなり、色で同時に見せる）。
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const bounds = parseMapBounds(searchParams);
  if (!bounds) {
    return NextResponse.json({ error: "invalid_bounds" }, { status: 400 });
  }
  // explore-mode Task 4: 探すモードの絞り込み（categories／cost／duration／rating／manual）。
  // 不正な値は parseSpotFilters が無視するので、400 にはしない（地図が出ないより条件なしで出す方がよい）
  const filters = parseSpotFilters(searchParams);

  // 他ユーザーの投稿・ブロック関係の判定を含むため service_role で読み、可視性はライブラリ側で絞る
  try {
    const pins = await getMapPins(createAdminClient(), user.id, bounds, filters);
    return NextResponse.json({ pins });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

/**
 * F-PO-01 スポット指定 Task5: スポット登録（重複防止ロジック含む）
 * 出典: docs/tasks/posts/spot-selection/05-manual-spot-registration-handler.md
 *
 * 手動登録（source='manual'）と、Google Places候補を選択した際の登録（source='places'）の
 * 両方を扱う。いずれも半径50m以内に既存スポットがあれば登録せず既存スポットを返し、
 * クライアント側でその選択を促す（要件定義書3.3.5）。
 * 登録したスポットは以降、全ユーザーの検索候補（Task2）に表示される。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    name?: unknown;
    lat?: unknown;
    lng?: unknown;
    source?: unknown;
    // #700: Google から保存してよい唯一の値（要件 6.2）
    placeId?: unknown;
    // #700: 利用者が投稿画面で確認した都道府県。無ければサーバーが逆引きする
    prefecture?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const { lat, lng, source } = body;
  const placeId = parsePlaceId(body.placeId);
  const confirmedPrefecture = parseConfirmedPrefecture(body.prefecture);

  if (placeId === "invalid") {
    return NextResponse.json({ error: "invalid_place_id" }, { status: 400 });
  }
  if (confirmedPrefecture === "invalid") {
    return NextResponse.json({ error: "invalid_prefecture" }, { status: 400 });
  }

  if (name.length === 0 || graphemeLength(name) > MAX_SPOT_NAME_LENGTH) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }
  if (typeof lat !== "number" || lat < -90 || lat > 90) {
    return NextResponse.json({ error: "invalid_lat" }, { status: 400 });
  }
  if (typeof lng !== "number" || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "invalid_lng" }, { status: 400 });
  }
  if (source !== "manual" && source !== "places") {
    return NextResponse.json({ error: "invalid_source" }, { status: 400 });
  }

  // スポットは全ユーザー共有のマスタのため、書き込みはService Role Key経由で行う
  const admin = createAdminClient();

  let nearby;
  try {
    nearby = await findNearbySpots(admin, lat, lng, DUPLICATE_SPOT_RADIUS_METERS);
  } catch {
    // 重複判定ができない状態で登録を通すと重複スポットが増えるため、ここでは中断する
    return NextResponse.json({ error: "nearby_lookup_failed" }, { status: 503 });
  }

  if (nearby.length > 0) {
    return NextResponse.json(
      { error: "duplicate_spot", existingSpot: nearby[0] },
      { status: 409 }
    );
  }

  const { data: spot, error: insertError } = await admin
    .from("spots")
    // v3.2: 手動登録なら登録者を記録する（スポット登録バッジ）
    .insert({
      name,
      lat,
      lng,
      source,
      // #700: Google 由来のときだけ Place ID が付く（手動登録には無い）
      ...(placeId ? { place_id: placeId } : {}),
      // #700: 利用者が確認した都道府県があれば、逆引きを待たずにそれを入れる
      ...(confirmedPrefecture ? { prefecture: confirmedPrefecture } : {}),
      ...(source === "manual" ? { created_by: user.id } : {}),
    })
    .select("id, name, lat, lng, prefecture, source")
    .single();

  if (insertError || !spot) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  // #700: 利用者が投稿画面で確認した都道府県があるときは、そちらを正とする（Google に問い合わせない）
  if (confirmedPrefecture) {
    return NextResponse.json({ spot }, { status: 201 });
  }

  // Task6: 都道府県を一度だけ確定させる。
  // 判定できなくてもスポット登録自体は成立させる（バッジ判定側で未設定を許容する）
  try {
    const prefecture = await reverseGeocodePrefecture(lat, lng);
    if (prefecture) {
      const { data: updated } = await admin
        .from("spots")
        .update({ prefecture })
        .eq("id", spot.id)
        .select("id, name, lat, lng, prefecture, source")
        .single();

      if (updated) {
        return NextResponse.json({ spot: updated }, { status: 201 });
      }
    }
  } catch {
    // Geocoding APIの障害は登録失敗にしない
  }

  return NextResponse.json({ spot }, { status: 201 });
}

/**
 * #700: Place ID の検査。Google が返す ID は英数字と記号の文字列で、長さに決まった上限は
 * 示されていないため、常識的な長さで切る（おかしな値をそのまま保存しないため）。
 *
 * 戻り値は「正しい値」「無い（null）」「おかしい（"invalid"）」の 3 つ。
 */
export function parsePlaceId(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return "invalid";
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 255) return "invalid";
  return trimmed;
}

/**
 * #700: 利用者が確認した都道府県の検査。**47 の名前のどれかでなければ受け取らない**
 * （自由入力をそのまま入れると、バッジの集計（都道府県バッジ）が合わなくなる）。
 */
export function parseConfirmedPrefecture(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return "invalid";
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return findPrefecture(trimmed) ? trimmed : "invalid";
}
