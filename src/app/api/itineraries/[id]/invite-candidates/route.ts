import { NextResponse } from "next/server";
import { authorizeItinerary, isErrorResponse } from "@/lib/itineraries/route-helpers";
import { listInviteCandidates } from "@/lib/invitations/in-app";

/**
 * feedback-0919 Task6（v3.2）: GET /api/itineraries/[id]/invite-candidates
 * 「一緒だった人」（自分と同じアルバム・しおりに入ったことがある人）を返す。オーナーだけ（招待できる人）。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await authorizeItinerary(id, "invite");
  if (isErrorResponse(context)) return context;
  try {
    return NextResponse.json({ candidates: await listInviteCandidates(context.admin, context.userId, "itinerary", id) });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
