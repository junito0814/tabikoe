import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getAlbumRole } from "@/lib/albums/membership";

/**
 * F-RC-03 Task6: メンバー自身の退出
 * 出典: docs/tasks/records/album-collaboration/06-member-self-removal-handler.md
 *
 * オーナーは退出できない（オーナーの離脱は退会時の継承ルールのみ。3.6.3）。
 * 退出しても本人の投稿はアルバムに残る（posts.trip_id は変更しない）。
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const role = await getAlbumRole(admin, id, user.id);
  if (!role) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (role === "owner") {
    return NextResponse.json({ error: "owner_cannot_leave" }, { status: 400 });
  }

  const { error } = await admin.from("album_members").delete().eq("trip_id", id).eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ left: true });
}
