import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ItineraryInvitationAcceptScreen } from "@/components/itineraries/ItineraryInvitationAcceptScreen";
import { evaluateInvitation } from "@/lib/itineraries/invitations";
import { ContentEnter } from "@/components/transitions/Reveal";

/**
 * しおりの招待リンクの着地ページ
 * 出典: docs/tasks/itinerary/itinerary-sharing/01-invitation-links.md
 *
 * 未ログインならログイン画面へ誘導し、ログイン後にここへ戻す（3.5.4）。
 * トークンの有効性を確認して、受諾ボタンまたは無効の案内を出す。
 */
export default async function ItineraryInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, `/itinerary-invitations/${token}`);

  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from("itinerary_invitations")
    .select("itinerary_id, expires_at, revoked_at, itineraries(trips(title))")
    .eq("token", token)
    .maybeSingle();
  if (!invitation) {
    return <ItineraryInvitationAcceptScreen token={token} invitation={{ status: "not_found" }} />;
  }
  const validity = evaluateInvitation(invitation);
  if (validity !== "valid") {
    return <ItineraryInvitationAcceptScreen token={token} invitation={{ status: validity }} />;
  }
  const { data: membership } = await admin.from("itinerary_members").select("role").eq("itinerary_id", invitation.itinerary_id).eq("user_id", user.id).maybeSingle();
  const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? (value[0] ?? null) : value);
  const trip = one(one((invitation as { itineraries: unknown }).itineraries as { trips: unknown } | null)?.trips as { title: string } | { title: string }[] | null);

  return (
    <ContentEnter>
      <ItineraryInvitationAcceptScreen
        token={token}
        invitation={{ status: "valid", title: trip?.title ?? "しおり", itineraryId: invitation.itinerary_id, alreadyMember: membership !== null }}
      />
    </ContentEnter>
  );
}
