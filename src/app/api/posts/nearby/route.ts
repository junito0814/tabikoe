import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getNearbyPosts, NEARBY_FETCH_CAP, parseNearbyRadius, radiusForTravelMode } from "@/lib/posts/nearby-posts";
import { parseTravelMode } from "@/lib/geo/travel-time";
import { boundsAround } from "@/lib/posts/search-posts";
import { findMatchingSpotIds } from "@/lib/map/get-map-pins";
import { hasActiveSpotFilters, parseSpotFilters } from "@/lib/map/spot-aggregate";

/**
 * explore-mode Task1: 近くの投稿 API
 * 出典: docs/tasks/browsing/explore-mode/01-nearby-posts-api.md
 *
 * GET /api/posts/nearby?lat&lng&mode=（walk／bicycle／car。v3.2。半径は徒歩 1km／自転車 3km／車 10km）
 *   旧 radius=（500／1000／3000）も互換のため受け付ける（mode があれば mode を優先）
 * 半径内の公開投稿を距離が近い順に最大 20 件返す（探すモードの「近くの声」）。
 *
 * explore-mode Task 4（2026-10-02）: 絞り込み（categories／cost／duration／rating／manual）を受ける。
 * 判定は**地図のピンと同じ関数**（`findMatchingSpotIds`）で行い、残ったスポットの投稿だけ返す。
 * こうしないと「地図に出ているピンが下のカードに無い」という食い違いが起きる。
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "invalid_location" }, { status: 400 });
  }
  const modeParam = searchParams.get("mode");
  const mode = parseTravelMode(modeParam);
  const radius = modeParam ? radiusForTravelMode(mode) : parseNearbyRadius(searchParams.get("radius"));

  const filters = parseSpotFilters(searchParams);

  try {
    const admin = createAdminClient();
    // 絞り込みが効いていないときは、余分な問い合わせをしない
    const allowedSpotIds = hasActiveSpotFilters(filters)
      ? await findMatchingSpotIds(admin, user.id, boundsAround({ lat, lng }, radius), filters, NEARBY_FETCH_CAP)
      : null;
    const posts = await getNearbyPosts(admin, user.id, { lat, lng }, radius, mode, { allowedSpotIds });
    return NextResponse.json({ radius, mode, posts });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
