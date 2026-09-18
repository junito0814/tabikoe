import { NextResponse } from "next/server";
import { getItinerary } from "@/lib/itineraries/get-itinerary";
import { authorizeItinerary, isErrorResponse } from "@/lib/itineraries/route-helpers";

/**
 * itinerary-sharing Task2: メンバー一覧（メンバーなら誰でも見られる）
 * 出典: docs/tasks/itinerary/itinerary-sharing/02-members-and-notifications.md
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await authorizeItinerary(id, "view");
  if (isErrorResponse(context)) return context;
  try {
    const itinerary = await getItinerary(context.admin, id, context.userId);
    if (!itinerary) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ members: itinerary.members, role: itinerary.role });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
