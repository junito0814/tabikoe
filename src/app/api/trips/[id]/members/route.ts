import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getAlbumMembers } from "@/lib/albums/get-album";
import { getAlbumRole } from "@/lib/albums/membership";

/**
 * F-RC-02 Task2: アルバムメンバー一覧
 * 出典: docs/tasks/records/album/02-album-members-list.md
 *
 * メンバーのみ参照できる。ロール（オーナー／編集者／閲覧者）とユーザー名・アイコンを返す。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  try {
    const role = await getAlbumRole(admin, id, user.id);
    if (!role) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const members = await getAlbumMembers(admin, id);
    return NextResponse.json({ members, viewerRole: role });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
