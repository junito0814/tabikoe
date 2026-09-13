import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { parsePostSearchParams, searchPostCards } from "@/lib/posts/search-posts";

/**
 * F-MP-04 Task1: 投稿検索・絞り込み Route Handler
 * 出典: docs/tasks/map-search/post-filter/01-post-filter-handler.md
 *
 * クエリ: q（スポット名）、categories（カンマ区切り）、distance（500|1000|3000|5000）＋lat/lng（地図の中心）、
 *         cost（1000|3000|5000|over）、duration、offset。
 * 公開投稿のみ対象（3.4.4）。1回20件で、`nextOffset` を次の読み込みに渡す。
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const filters = parsePostSearchParams(searchParams);
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  try {
    const page = await searchPostCards(createAdminClient(), user.id, filters, offset);
    return NextResponse.json(page);
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
