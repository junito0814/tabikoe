import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getAlbumRole } from "@/lib/albums/membership";

/**
 * F-RC-03 Task3: 招待リンクの無効化（オーナーのみ）
 * 出典: docs/tasks/records/album-collaboration/03-invitation-revoke-handler.md
 *
 * revoked_at に現在時刻を入れる（物理削除しない）。受諾処理（Task4）は revoked_at 付きを無効として扱う。
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; invitationId: string }> }
) {
  const { id, invitationId } = await params;
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
  if (role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("album_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("trip_id", id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  // 既に無効化済み・存在しない場合も、結果としては無効なので冪等に扱う
  return NextResponse.json({ revoked: true, alreadyRevoked: data === null });
}
