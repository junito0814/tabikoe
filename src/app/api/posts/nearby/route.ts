import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getNearbyPosts, parseNearbyRadius, radiusForTravelMode } from "@/lib/posts/nearby-posts";
import { parseTravelMode } from "@/lib/geo/travel-time";

/**
 * explore-mode Task1: 近くの投稿 API
 * 出典: docs/tasks/browsing/explore-mode/01-nearby-posts-api.md
 *
 * GET /api/posts/nearby?lat&lng&mode=（walk／bicycle／car。v3.2。半径は徒歩 1km／自転車 3km／車 10km）
 *   旧 radius=（500／1000／3000）も互換のため受け付ける（mode があれば mode を優先）
 * 半径内の公開投稿を距離が近い順に最大 20 件返す（探すモードの「近くの声」）。
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

  try {
    const posts = await getNearbyPosts(createAdminClient(), user.id, { lat, lng }, radius, mode);
    return NextResponse.json({ radius, mode, posts });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
