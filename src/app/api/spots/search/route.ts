import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { PlacesApiError, searchPlaces } from "@/lib/google/places";

const MAX_RESULTS = 5;

export interface SpotSearchCandidate {
  /** 既に`spots`に存在する場合のみ入る。Google由来の未登録候補ではnull */
  id: string | null;
  name: string;
  lat: number;
  lng: number;
  source: "places" | "manual";
  postCount: number;
}

/**
 * F-PO-01 スポット指定 Task2: スポット候補検索
 * 出典: docs/tasks/posts/spot-selection/02-spot-search-handler.md
 *
 * Google Places APIの検索結果と、Supabase上の登録済みスポットを統合し、
 * 投稿数が多い順に最大5件返す（要件定義書3.3.5）。
 * Places APIが落ちていても登録済みスポットの候補と手動登録の導線は維持する（要件6.2）。
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";
  if (query.length === 0) {
    return NextResponse.json({ candidates: [], placesUnavailable: false });
  }

  // 登録済みスポットは投稿数つきで取得する。
  // 投稿数の集計は他ユーザーの投稿も含むためRLSを回避する必要があり、Adminクライアントを使う。
  const admin = createAdminClient();
  const escaped = query.replace(/[\\%_]/g, (char) => `\\${char}`);
  const { data: storedSpots, error: storedError } = await admin
    .from("spots")
    .select("id, name, lat, lng, source, posts(count)")
    .ilike("name", `%${escaped}%`)
    .limit(MAX_RESULTS);

  if (storedError) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  const stored: SpotSearchCandidate[] = (storedSpots ?? []).map((spot) => ({
    id: spot.id,
    name: spot.name,
    lat: spot.lat,
    lng: spot.lng,
    source: spot.source,
    postCount: spot.posts?.[0]?.count ?? 0,
  }));

  let placesUnavailable = false;
  let placeCandidates: SpotSearchCandidate[] = [];
  try {
    const places = await searchPlaces(query, MAX_RESULTS);
    // 既に登録済みのスポットと同名のGoogle候補は重複表示しない
    const storedNames = new Set(stored.map((spot) => spot.name));
    placeCandidates = places
      .filter((place) => !storedNames.has(place.name))
      .map((place) => ({
        id: null,
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        source: "places" as const,
        postCount: 0,
      }));
  } catch (error) {
    if (!(error instanceof PlacesApiError)) {
      throw error;
    }
    placesUnavailable = true;
  }

  // 投稿数が多い順。Google由来の未登録候補は投稿数0なので自然と後ろに並ぶ
  const candidates = [...stored, ...placeCandidates]
    .sort((a, b) => b.postCount - a.postCount)
    .slice(0, MAX_RESULTS);

  return NextResponse.json({ candidates, placesUnavailable });
}
