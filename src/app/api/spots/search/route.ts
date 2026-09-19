import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { parsePostSearchParams } from "@/lib/posts/search-posts";
import { parseSpotSort, searchSpotCards } from "@/lib/spots/search-spots";

/**
 * mentoring-7 Task3（v3.1）: スポット単位の検索 Route Handler
 * 出典: docs/tasks/shared-ui/mentoring-7/03-spot-cards.md
 *       要件定義書 v3.1 3.4.2
 *
 * クエリは /api/posts/search と同じ（行き先・絞り込み・vlat/vlng・offset）。違いは
 *   並び替え: sort=newest|rating|count（新着順／評価順／投稿数順）
 *   応答: { spots: SpotCardData[], nextOffset }
 * 検索トップから都道府県・駅・市区町村で検索したときの一覧（スポットカード）がこれを使う。
 * スポット別（spot=<id>）は従来どおり /api/posts/search。
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const filters = parsePostSearchParams(searchParams);
  const sort = parseSpotSort(searchParams.get("sort"));
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  try {
    const page = await searchSpotCards(createAdminClient(), user.id, filters, sort, offset);
    return NextResponse.json(page);
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
