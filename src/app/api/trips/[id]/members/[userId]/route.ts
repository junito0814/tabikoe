import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { createNotification } from "@/lib/notifications/create-notification";
import { getAlbumRole, isInvitableRole } from "@/lib/albums/membership";

/**
 * F-RC-03 Task5・Task7: メンバーの権限変更・削除（オーナーのみ）＋通知
 * 出典: docs/tasks/records/album-collaboration/05-member-role-management-handler.md
 *       docs/tasks/records/album-collaboration/07-notification-integration.md
 *
 * オーナー自身の権限変更・削除は不可（オーナー交代は退会時の継承ルールのみ。3.6.3）。
 * 付与できる権限は editor / viewer。
 */
type OwnerAuthorization =
  | { response: NextResponse }
  | { admin: ReturnType<typeof createAdminClient>; user: { id: string } };

async function authorizeOwner(tripId: string, targetUserId: string): Promise<OwnerAuthorization> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const admin = createAdminClient();
  const role = await getAlbumRole(admin, tripId, user.id);
  if (!role) {
    return { response: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  }
  if (role !== "owner") {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  if (targetUserId === user.id) {
    return { response: NextResponse.json({ error: "cannot_modify_owner" }, { status: 400 }) };
  }
  const { data: target } = await admin
    .from("album_members")
    .select("id, role")
    .eq("trip_id", tripId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!target) {
    return { response: NextResponse.json({ error: "member_not_found" }, { status: 404 }) };
  }
  if (target.role === "owner") {
    return { response: NextResponse.json({ error: "cannot_modify_owner" }, { status: 400 }) };
  }
  return { admin, user };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
): Promise<NextResponse> {
  const { id, userId } = await params;

  let body: { role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!isInvitableRole(body.role)) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }

  const auth = await authorizeOwner(id, userId);
  if ("response" in auth) return auth.response;

  const { error } = await auth.admin
    .from("album_members")
    .update({ role: body.role })
    .eq("trip_id", id)
    .eq("user_id", userId);
  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  // Task7: 権限を変更されたメンバー本人へ通知
  await createNotification(auth.admin, {
    recipientId: userId,
    actorId: auth.user.id,
    type: "role_change",
    relatedId: id,
  });

  return NextResponse.json({ userId, role: body.role });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
): Promise<NextResponse> {
  const { id, userId } = await params;
  const auth = await authorizeOwner(id, userId);
  if ("response" in auth) return auth.response;

  // 退出・削除しても本人の投稿はアルバムに残る（posts.trip_id は変更しない。3.6.3）
  const { error } = await auth.admin
    .from("album_members")
    .delete()
    .eq("trip_id", id)
    .eq("user_id", userId);
  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  // Task7: 削除されたメンバー本人へ通知
  await createNotification(auth.admin, {
    recipientId: userId,
    actorId: auth.user.id,
    type: "member_removed",
    relatedId: id,
  });

  return NextResponse.json({ removed: true });
}
