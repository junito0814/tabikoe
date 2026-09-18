import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { parsePostSearchParams, searchPostCards } from "@/lib/posts/search-posts";

/**
 * F-MP-04 Task1 / post-timeline Task1（v3.0）: 投稿検索・絞り込み Route Handler
 * 出典: docs/tasks/map-search/post-filter/01-post-filter-handler.md
 *       docs/tasks/map-search/post-timeline/01-search-api-destination.md
 *
 * クエリ:
 *   行き先（いずれか 1 つ。v3.0）: pref=大阪府 ／ lat&lng（周辺 5km。q はラベル）／ spot=<id>
 *   絞り込み: categories（カンマ区切り）、distance（500|1000|3000|5000。lat/lng が基準）、
 *            cost（1000|3000|5000|over）、duration、period（this_month|last_month|custom）＋from/to
 *   並び替え: sort=newest|rating|likes
 *   閲覧者の現在地: vlat&vlng（「徒歩 N 分」の計算に使うだけで、絞り込みには使わない）
 *   ページング: offset（1 回 20 件。`nextOffset` を次の読み込みに渡す）
 * 公開済み（status=published）の投稿のみ対象（3.4.2）。
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
