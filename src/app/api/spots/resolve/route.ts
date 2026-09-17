import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { parseLatLng, resolveSpotByLocation } from "@/lib/spots/resolve-by-location";

/**
 * GET /api/spots/resolve?lat&lng — 位置から登録済みスポットを解決する（spot-selection-v3 Task2）
 * 出典: docs/tasks/posts/spot-selection-v3/02-resolve-spot-by-location.md
 *
 * 半径 50m 以内に登録済みスポットがあればそれを、無ければ null を返す。SC-03 の地図を動かすたびに呼ばれる
 * （ブラウザ側で 300ms の debounce をかける）。
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
    const spot = await resolveSpotByLocation(createAdminClient(), position.lat, position.lng);
    return NextResponse.json({ spot });
  } catch {
    return NextResponse.json({ error: "lookup_failed" }, { status: 503 });
  }
}
