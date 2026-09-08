import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { GeocodingApiError, reverseGeocodePrefecture } from "@/lib/google/geocoding";

/**
 * F-PO-01 スポット指定 Task6: 逆ジオコーディングによる都道府県判定
 * 出典: docs/tasks/posts/spot-selection/06-prefecture-reverse-geocoding.md
 *
 * 通常はスポット登録（POST /api/spots）の中で同じ処理を実行するため、
 * このエンドポイントは登録時にGeocoding APIが落ちていた等で
 * prefectureが未設定のまま残ったスポットを補完するために使う。
 * 「一度だけ保存する」仕様のため、既に設定済みなら再取得しない。
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: spot, error: fetchError } = await admin
    .from("spots")
    .select("id, lat, lng, prefecture")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  if (!spot) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (spot.prefecture) {
    return NextResponse.json({ prefecture: spot.prefecture, updated: false });
  }

  let prefecture: string | null;
  try {
    prefecture = await reverseGeocodePrefecture(spot.lat, spot.lng);
  } catch (error) {
    if (error instanceof GeocodingApiError) {
      return NextResponse.json({ error: "geocoding_unavailable" }, { status: 503 });
    }
    throw error;
  }

  if (!prefecture) {
    return NextResponse.json({ prefecture: null, updated: false });
  }

  const { error: updateError } = await admin
    .from("spots")
    .update({ prefecture })
    .eq("id", spot.id);

  if (updateError) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ prefecture, updated: true });
}
