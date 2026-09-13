import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { graphemeLength } from "@/lib/text/grapheme-length";
import { DUPLICATE_SPOT_RADIUS_METERS, findNearbySpots } from "@/lib/spots/nearby";
import { reverseGeocodePrefecture } from "@/lib/google/geocoding";
import {
  getAllTabPins,
  getWishlistTabPins,
  parseMapBounds,
  parseMapView,
} from "@/lib/map/get-map-pins";

/** スポット名の最大文字数（要件定義書3.3.1） */
const MAX_SPOT_NAME_LENGTH = 200;

/**
 * F-MP-01 Task1・Task2: 全体マップ（SC-02）のピン取得
 * 出典: docs/tasks/map-search/map-display/01-spots-fetch-handler.md
 *       docs/tasks/map-search/map-display/02-wishlist-tab-integration.md
 *
 * `view=all`（既定）は、指定範囲内で公開投稿が1件以上あるスポットを1スポット1ピンで返す。
 * `view=wishlist` は、ログインユーザー自身が「行きたい」保存したスポットのみ返す（専用エンドポイントは設けず、
 * 同じ矩形・同じ上限100件の制約を共有するためパラメータで切り替える）。
 * 範囲は north/south/east/west（度）で受け取る。
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
  const view = parseMapView(searchParams.get("view"));

  // 他ユーザーの投稿・ブロック関係の判定を含むため service_role で読み、可視性はライブラリ側で絞る
  const admin = createAdminClient();
  try {
    const pins =
      view === "wishlist"
        ? await getWishlistTabPins(admin, user.id, bounds)
        : await getAllTabPins(admin, user.id, bounds);
    return NextResponse.json({ view, pins });
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

  let body: { name?: unknown; lat?: unknown; lng?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const { lat, lng, source } = body;

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
    .insert({ name, lat, lng, source })
    .select("id, name, lat, lng, prefecture, source")
    .single();

  if (insertError || !spot) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
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
