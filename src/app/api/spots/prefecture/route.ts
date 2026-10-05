import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { parseLatLng } from "@/lib/spots/resolve-by-location";
import { reverseGeocodePrefecture } from "@/lib/google/geocoding";

/**
 * GET /api/spots/prefecture?lat&lng — 座標から都道府県を引く（#700）
 * 出典: 要件定義書 6.2「Google から借りるものの方針」・3.3.5
 *
 * 【初心者向け】なぜこれが要るか ── #700 で「スポットの値は**利用者が確認して確定したもの**に
 * する」と決めた。都道府県も確認してもらうので、**あらかじめ埋めておく**ための窓口。
 * 答えは画面に出すだけで、**保存するのは利用者が確定したあと**（POST /api/spots）。
 *
 * 保存しないので、規約の「保存禁止」には当たらない（要件 6.2）。
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const position = parseLatLng(new URL(request.url).searchParams);
  if (!position) {
    return NextResponse.json({ error: "invalid_location" }, { status: 400 });
  }
  try {
    const prefecture = await reverseGeocodePrefecture(position.lat, position.lng);
    return NextResponse.json({ prefecture: prefecture ?? null });
  } catch {
    // 引けなくても画面は進める（利用者が自分で選べる）
    return NextResponse.json({ prefecture: null });
  }
}
