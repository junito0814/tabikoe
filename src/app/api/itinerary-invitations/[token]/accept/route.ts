import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { createNotificationsForMany } from "@/lib/notifications/create-notification";
import { acceptItineraryInvitation, evaluateInvitation } from "@/lib/itineraries/invitations";

/**
 * itinerary-sharing Task1・Task2: 招待の受諾（member として追加）＋参加通知
 * 出典: docs/tasks/itinerary/itinerary-sharing/01-invitation-links.md
 *       docs/tasks/itinerary/itinerary-sharing/02-members-and-notifications.md
 *
 * 【初心者向け】受諾の本体は DB の security definer 関数 accept_itinerary_invitation（期限・無効化の検証と
 * itinerary_members への追加）。ここでは 404／410 の出し分けと通知を担当する。
 * 無効化済み・期限切れは 410 Gone。既にメンバーなら重複登録しない（alreadyMember）。
 * 通知（itinerary_joined）は本人・オーナー・既存メンバーへ（related_id = itinerary_id）。
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
    .from("itinerary_invitations")
    .select("id, itinerary_id, expires_at, revoked_at")
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

  const { data: existing } = await admin.from("itinerary_members").select("role").eq("itinerary_id", invitation.itinerary_id).eq("user_id", user.id).maybeSingle();
  if (existing) {
    return NextResponse.json({ itineraryId: invitation.itinerary_id, role: existing.role, alreadyMember: true });
  }

  let itineraryId: string | null;
  try {
    itineraryId = await acceptItineraryInvitation(admin, token, user.id);
  } catch {
    return NextResponse.json({ error: "accept_failed" }, { status: 500 });
  }
  if (!itineraryId) {
    return NextResponse.json({ error: "invitation_expired" }, { status: 410 });
  }

  // 参加通知: 本人・オーナー・既存メンバー（createNotificationsForMany は actor 本人を除くので本人は別に作る）
  const { data: members } = await admin.from("itinerary_members").select("user_id").eq("itinerary_id", itineraryId);
  const others = ((members ?? []) as { user_id: string }[]).map((row) => row.user_id).filter((memberId) => memberId !== user.id);
  await createNotificationsForMany(admin, { recipientIds: others, actorId: user.id, type: "itinerary_joined", relatedId: itineraryId });
  await createNotificationsForMany(admin, { recipientIds: [user.id], actorId: null, type: "itinerary_joined", relatedId: itineraryId });

  return NextResponse.json({ itineraryId, role: "member", alreadyMember: false }, { status: 201 });
}
