import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getSpotMediaPage } from "@/lib/posts/spot-photos";

/**
 * F-MP-05 Task1: スポット写真一覧取得
 * 出典: docs/tasks/map-search/spot-photo-gallery/01-spot-photos-handler.md
 *
 * 指定スポットの公開投稿の写真・動画を投稿をまたいで新着順に返す。`offset` で40点ずつ追加読み込み。
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const offset = Math.max(
    0,
    Number.parseInt(new URL(request.url).searchParams.get("offset") ?? "0", 10) || 0
  );

  const admin = createAdminClient();
  const { data: spot } = await admin.from("spots").select("id").eq("id", id).maybeSingle();
  if (!spot) {
    return NextResponse.json({ error: "spot_not_found" }, { status: 404 });
  }

  try {
    const page = await getSpotMediaPage(admin, user.id, id, offset);
    return NextResponse.json(page);
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
