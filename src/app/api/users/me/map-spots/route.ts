import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { parseMapBounds } from "@/lib/map/get-map-pins";
import { getMyMapPins, parseMyMapMode } from "@/lib/map/get-my-map-pins";

/**
 * F-RC-06 Task1: マイマップ用ピンデータ取得
 * 出典: docs/tasks/records/my-map/01-my-map-pin-data-handler.md
 *
 * `mode=posted|wishlist|both`（既定 both）と地図範囲（north/south/east/west）を受け取り、
 * 本人の投稿があるスポット（非公開含む）と「行きたい」スポットを最大100件返す。
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
  const mode = parseMyMapMode(searchParams.get("mode"));

  try {
    const pins = await getMyMapPins(createAdminClient(), user.id, mode, bounds);
    return NextResponse.json({ mode, pins });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
