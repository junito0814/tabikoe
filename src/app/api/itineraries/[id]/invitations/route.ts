import { NextResponse } from "next/server";
import { RATE_LIMIT_ACTIONS } from "@/lib/rate-limit/actions";
import { isWithinRateLimit } from "@/lib/rate-limit/check-rate-limit";
import { buildItineraryInvitationPath, evaluateInvitation, issueItineraryInvitation } from "@/lib/itineraries/invitations";
import { authorizeItinerary, isErrorResponse } from "@/lib/itineraries/route-helpers";
import { sendInAppInvitation } from "@/lib/invitations/in-app";

/**
 * itinerary-sharing Task1: 招待リンクの発行・一覧（オーナーのみ）
 * 出典: docs/tasks/itinerary/itinerary-sharing/01-invitation-links.md
 *       要件定義書 v3.0 3.11.7（7 日で失効、役割は member 固定）
 *
 * POST /api/itineraries/[id]/invitations  → { invitation: { id, path, expiresAt } }。レート制限 itinerary_invite
 *   v3.2: body に inviteeUserId があればアプリ内招待（{ invitation: { id, inviteeUserId } }。同じ枠で数える）
 *   #869: body の inviteToAlbum が false なら、同じ旅行のアルバムには招待しない（既定は招待する）
 * GET  /api/itineraries/[id]/invitations  → 有効な招待の一覧（無効化の UI 用）
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await authorizeItinerary(id, "invite");
  if (isErrorResponse(context)) return context;
  // v3.2（feedback-0919 Task6）: inviteeUserId があればアプリ内招待（宛先に通知）。無ければ従来のリンク発行
  const body = await request.json().catch(() => ({}));
  const inviteeUserId = typeof body?.inviteeUserId === "string" && body.inviteeUserId.length > 0 ? body.inviteeUserId : null;

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

  if (inviteeUserId) {
    /*
     * #869（2026-10-07）: `inviteToAlbum` が false のときだけアルバムを外す（既定は true）。
     * 送る側が決めたことなので、受諾のときに読めるよう招待の行に覚える（要件 3.11.7）。
     */
    const inviteToAlbum = body?.inviteToAlbum !== false;
    const sent = await sendInAppInvitation(context.admin, { kind: "itinerary", targetId: id, inviterId: context.userId, inviteeId: inviteeUserId, inviteToAlbum });
    if (!sent.ok) {
      const status = sent.error === "insert_failed" ? 500 : sent.error === "invitee_not_found" ? 404 : 409;
      return NextResponse.json({ error: sent.error }, { status });
    }
    return NextResponse.json({ invitation: { id: sent.invitationId, inviteeUserId } }, { status: 201 });
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
    .select("id, token, expires_at, revoked_at, created_at, invitee_user_id, status, users:invitee_user_id(display_name)")
    .eq("itinerary_id", id)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  type Row = { id: string; token: string; expires_at: string; revoked_at: string | null; created_at: string; invitee_user_id: string | null; status: string; users: { display_name: string | null } | { display_name: string | null }[] | null };
  const rows = (data ?? []) as unknown as Row[];
  // リンク招待（宛先なし）
  const invitations = rows
    .filter((row) => !row.invitee_user_id && evaluateInvitation(row) === "valid")
    .map((row) => ({ id: row.id, path: buildItineraryInvitationPath(row.token), expiresAt: row.expires_at, createdAt: row.created_at }));
  // v3.2: 未回答のアプリ内招待（取り消しの UI 用）
  const pending = rows
    .filter((row) => row.invitee_user_id && row.status === "pending" && evaluateInvitation(row) === "valid")
    .map((row) => ({ id: row.id, inviteeUserId: row.invitee_user_id as string, inviteeName: (Array.isArray(row.users) ? row.users[0] : row.users)?.display_name ?? "ユーザー", expiresAt: row.expires_at }));
  return NextResponse.json({ invitations, pending });
}
