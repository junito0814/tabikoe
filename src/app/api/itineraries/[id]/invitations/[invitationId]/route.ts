import { NextResponse } from "next/server";
import { authorizeItinerary, isErrorResponse } from "@/lib/itineraries/route-helpers";

/**
 * itinerary-sharing Task1: 招待リンクの無効化（オーナーのみ）
 * 出典: docs/tasks/itinerary/itinerary-sharing/01-invitation-links.md
 *
 * DELETE /api/itineraries/[id]/invitations/[invitationId] → revoked_at を立てる（行は残す）
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; invitationId: string }> }) {
  const { id, invitationId } = await params;
  const context = await authorizeItinerary(id, "invite");
  if (isErrorResponse(context)) return context;
  const { data, error } = await context.admin
    .from("itinerary_invitations")
    // v3.2: アプリ内招待の取り消しも同じ（status も revoked に）
    .update({ revoked_at: new Date().toISOString(), status: "revoked" })
    .eq("id", invitationId)
    .eq("itinerary_id", id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
