import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getAlbumMediaPage } from "@/lib/albums/album-photos";

/**
 * アルバム写真一覧 Task1: アルバム内の写真・動画の取得
 * 出典: docs/tasks/records/album-photos/01-album-photos-handler.md
 *
 * メンバー以外は404（アルバムの存在を伏せる）。`offset` で40点ずつ追加読み込み。
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
