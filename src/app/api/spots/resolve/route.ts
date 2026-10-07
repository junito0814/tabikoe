import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { parseLatLng, resolveSpotByLocation } from "@/lib/spots/resolve-by-location";
import { loadSpotCategoryForCompose } from "@/lib/posts/load-compose-data";

/**
 * GET /api/spots/resolve?lat&lng — 位置から登録済みスポットを解決する（spot-selection-v3 Task2）
 * 出典: docs/tasks/posts/spot-selection-v3/02-resolve-spot-by-location.md
 *
 * 半径 50m 以内に登録済みスポットがあればそれを、無ければ null を返す。SC-03 の地図を動かすたびに呼ばれる
 * （ブラウザ側で 300ms の debounce をかける）。
 *
 * #865（2026-10-07）: **そのスポットの代表カテゴリ**も一緒に返す。
 *
 * 【初心者向け】カテゴリの「おすすめ」（#794）は、もともと URL に `?spot=` が付いているときだけ
 * サーバーで引いていた。ところが**いちばんよく使う入口**（ホームの「＋ ここに投稿」・地図の長押し）は
 * `?spot=` を付けず、スポットは**この API で後から**決まる。そのため「おすすめ」が出なかった。
 * スポットが決まるのと同じ応答に入れておけば、往復が増えない。
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
    const admin = createAdminClient();
    const spot = await resolveSpotByLocation(admin, position.lat, position.lng);
    // #865: 見つかったときだけ代表カテゴリを引く（見つからなければ引く相手がいない）
    const category = spot ? await loadSpotCategoryForCompose(admin, spot.id) : null;
    return NextResponse.json({ spot: spot ? { ...spot, category } : null });
  } catch {
    return NextResponse.json({ error: "lookup_failed" }, { status: 503 });
  }
}
