import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getNearbyPosts, parseNearbyRadius } from "@/lib/posts/nearby-posts";

/**
 * explore-mode Task1: 近くの投稿 API
 * 出典: docs/tasks/browsing/explore-mode/01-nearby-posts-api.md
 *
 * GET /api/posts/nearby?lat&lng&radius=（500／1000／3000、既定 1000）
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
  const radius = parseNearbyRadius(searchParams.get("radius"));

  try {
    const posts = await getNearbyPosts(createAdminClient(), user.id, { lat, lng }, radius);
    return NextResponse.json({ radius, posts });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
