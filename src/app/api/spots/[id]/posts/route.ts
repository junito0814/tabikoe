import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getSpotPostCards, parsePostSort } from "@/lib/posts/post-cards";

/**
 * F-MP-03 Task1: スポット別投稿一覧取得
 * 出典: docs/tasks/map-search/pin-interaction/01-spot-posts-handler.md
 *
 * 指定スポットに紐づく公開投稿を返す。`sort=newest|rating|likes`（既定 newest）、
 * `offset` で20件ずつの追加読み込みに対応する。投稿が無ければ空配列。
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const sort = parsePostSort(searchParams.get("sort"));
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  const admin = createAdminClient();
  const { data: spot } = await admin.from("spots").select("id").eq("id", id).maybeSingle();
  if (!spot) {
    return NextResponse.json({ error: "spot_not_found" }, { status: 404 });
  }

  try {
    const page = await getSpotPostCards(admin, user.id, id, sort, offset);
    return NextResponse.json({ sort, ...page });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
