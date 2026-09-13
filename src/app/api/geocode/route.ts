import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { geocodePlace, GeocodingApiError } from "@/lib/google/geocoding";

/** 地名の最大長。無制限の入力をそのまま外部APIに流さない */
const MAX_QUERY_LENGTH = 200;

/**
 * F-MP-02 Task1: 地名検索 Route Handler
 * 出典: docs/tasks/map-search/place-search/01-geocode-handler.md
 *
 * Geocoding API はサーバー側からのみ呼び、APIキー（GOOGLE_GEOCODING_API_KEY）はブラウザに渡さない（6.3）。
 * 地図の移動にだけ使い、投稿の絞り込み（F-MP-04）には関与しない（3.4.2）。
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";
  if (query.length === 0 || query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  try {
    const place = await geocodePlace(query);
    if (!place) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ place });
  } catch (error) {
    if (error instanceof GeocodingApiError) {
      return NextResponse.json({ error: "geocoding_unavailable" }, { status: 503 });
    }
    throw error;
  }
}
