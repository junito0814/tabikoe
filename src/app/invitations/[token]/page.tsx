import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { InvitationAcceptScreen } from "@/components/albums/InvitationAcceptScreen";
import { evaluateInvitation } from "@/lib/albums/invitations";
import type { InvitableRole } from "@/lib/albums/membership";
import { ContentEnter } from "@/components/transitions/Reveal";

/**
 * 招待リンクの着地ページ
 * 出典: docs/tasks/records/album-collaboration/04-invitation-acceptance-handler.md
 *
 * 未ログインならログイン画面へ誘導し、ログイン後にここへ戻す（3.5.4）。
 * トークンの有効性を確認して、受諾ボタンまたは無効の案内を出す。
 */
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, `/invitations/${token}`);

  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from("album_invitations")
    .select("trip_id, role, expires_at, revoked_at, trips(title)")
    .eq("token", token)
    .maybeSingle();

  if (!invitation) {
    return <InvitationAcceptScreen token={token} invitation={{ status: "not_found" }} />;
  }

  const validity = evaluateInvitation(invitation);
  if (validity !== "valid") {
    return <InvitationAcceptScreen token={token} invitation={{ status: validity }} />;
  }

  const { data: membership } = await admin
    .from("album_members")
    .select("id")
    .eq("trip_id", invitation.trip_id)
    .eq("user_id", user.id)
    .maybeSingle();
  const trip = Array.isArray(invitation.trips) ? invitation.trips[0] : invitation.trips;

  return (
    <ContentEnter>
      <InvitationAcceptScreen
        token={token}
        invitation={{
          status: "valid",
          tripTitle: (trip as { title: string } | null)?.title ?? "アルバム",
          role: invitation.role as InvitableRole,
          alreadyMember: membership !== null,
        }}
      />
    </ContentEnter>
  );
}
