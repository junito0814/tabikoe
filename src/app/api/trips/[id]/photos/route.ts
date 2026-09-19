import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getAlbumMediaPage } from "@/lib/albums/album-photos";

/**
 * F-RC-05 Task1: アルバム写真一覧 API（SC-21）
 * 出典: docs/tasks/records/album-photos/01-album-photos-api.md
 *
 * GET /api/trips/[id]/photos?offset=
 * メンバーのみ。非公開投稿も含めて新着順に 40 点ずつ返す。メンバーでなければ 404（存在自体を伏せる）。
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const searchParams = new URL(request.url).searchParams;
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  try {
    const page = await getAlbumMediaPage(createAdminClient(), user.id, id, offset);
    if (!page) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(page);
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
