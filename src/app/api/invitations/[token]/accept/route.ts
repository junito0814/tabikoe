import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { createNotificationsForMany } from "@/lib/notifications/create-notification";
import { evaluateInvitation } from "@/lib/albums/invitations";

/**
 * F-RC-03 Task4・Task7: 招待の受諾（album_members への追加）＋参加通知
 * 出典: docs/tasks/records/album-collaboration/04-invitation-acceptance-handler.md
 *       docs/tasks/records/album-collaboration/07-notification-integration.md
 *
 * 無効化済み・期限切れは 410 Gone。既にメンバーなら重複登録せず既存のロールを維持する。
 * 未ログイン時のログイン誘導は招待ページ（/invitations/[token]）側が requireUserOrRedirect で行う。
 */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: invitation, error } = await admin
    .from("album_invitations")
    .select("id, trip_id, role, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  if (!invitation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const validity = evaluateInvitation(invitation);
  if (validity !== "valid") {
    return NextResponse.json({ error: `invitation_${validity}` }, { status: 410 });
  }

  const { data: existing } = await admin
    .from("album_members")
    .select("role")
    .eq("trip_id", invitation.trip_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ tripId: invitation.trip_id, role: existing.role, alreadyMember: true });
  }

  const { error: insertError } = await admin
    .from("album_members")
    .insert({ trip_id: invitation.trip_id, user_id: user.id, role: invitation.role });
  if (insertError) {
    if (insertError.code === "23505") {
      // 同時受諾。既存のロールを維持する
      return NextResponse.json({ tripId: invitation.trip_id, role: invitation.role, alreadyMember: true });
    }
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  // Task7: 参加した本人・オーナー・既存メンバー全員へ通知（3.9.1）
  const { data: members } = await admin
    .from("album_members")
    .select("user_id")
    .eq("trip_id", invitation.trip_id);
  await createNotificationsForMany(admin, {
    recipientIds: (members ?? []).map((member) => member.user_id as string),
    // 参加した本人にも届ける通知なので actorId は付けない（付けると本人分が除外される）
    actorId: null,
    type: "album_join",
    relatedId: invitation.trip_id,
  });

  return NextResponse.json(
    { tripId: invitation.trip_id, role: invitation.role, alreadyMember: false },
    { status: 201 }
  );
}
