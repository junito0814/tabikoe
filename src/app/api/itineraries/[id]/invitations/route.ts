import { NextResponse } from "next/server";
import { RATE_LIMIT_ACTIONS } from "@/lib/rate-limit/actions";
import { isWithinRateLimit } from "@/lib/rate-limit/check-rate-limit";
import { buildItineraryInvitationPath, evaluateInvitation, issueItineraryInvitation } from "@/lib/itineraries/invitations";
import { authorizeItinerary, isErrorResponse } from "@/lib/itineraries/route-helpers";

/**
 * itinerary-sharing Task1: 招待リンクの発行・一覧（オーナーのみ）
 * 出典: docs/tasks/itinerary/itinerary-sharing/01-invitation-links.md
 *       要件定義書 v3.0 3.11.7（7 日で失効、役割は member 固定）
 *
 * POST /api/itineraries/[id]/invitations  → { invitation: { id, path, expiresAt } }。レート制限 itinerary_invite
 * GET  /api/itineraries/[id]/invitations  → 有効な招待の一覧（無効化の UI 用）
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await authorizeItinerary(id, "invite");
  if (isErrorResponse(context)) return context;

  const limit = RATE_LIMIT_ACTIONS.itineraryInvite;
  let allowed: boolean;
  try {
    allowed = await isWithinRateLimit(context.admin, context.userId, limit.actionType, limit.windowSeconds, limit.limit);
  } catch {
    return NextResponse.json({ error: "rate_limit_unavailable" }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const invitation = await issueItineraryInvitation(context.admin, id, context.userId);
    return NextResponse.json(
      { invitation: { id: invitation.id, path: buildItineraryInvitationPath(invitation.token), expiresAt: invitation.expires_at } },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await authorizeItinerary(id, "invite");
  if (isErrorResponse(context)) return context;
  const { data, error } = await context.admin
    .from("itinerary_invitations")
    .select("id, token, expires_at, revoked_at, created_at")
    .eq("itinerary_id", id)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  const invitations = ((data ?? []) as { id: string; token: string; expires_at: string; revoked_at: string | null; created_at: string }[])
    .filter((row) => evaluateInvitation(row) === "valid")
    .map((row) => ({ id: row.id, path: buildItineraryInvitationPath(row.token), expiresAt: row.expires_at, createdAt: row.created_at }));
  return NextResponse.json({ invitations });
}
