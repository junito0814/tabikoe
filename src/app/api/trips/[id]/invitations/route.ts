import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getAlbumRole, isInvitableRole } from "@/lib/albums/membership";
import { isDailyTrip } from "@/lib/trips/daily-album";
import { sendInAppInvitation } from "@/lib/invitations/in-app";
import {
  buildInvitationPath,
  computeInvitationExpiry,
  evaluateInvitation,
  generateInvitationToken,
} from "@/lib/albums/invitations";

/**
 * F-RC-03 Task2: 招待リンク発行（オーナーのみ）
 * 出典: docs/tasks/records/album-collaboration/02-invitation-issue-handler.md
 *
 * 付与する権限（editor / viewer）を受け取り、7日後を期限とするトークンを発行する。
 *
 * 【初心者向け】URL の `[id]` は Next.js の動的ルートで、`params`（Promise）から取り出す。
 * 権限チェックは「ログイン → アルバムのメンバーか（404）→ オーナーか（403）」の順。
 * 404 と 403 を分けるのは、メンバー以外にはアルバムの存在自体を教えないため。
 * トークンは推測できない乱数（generateInvitationToken）で、URL に含めて相手に渡す。
 * しおりの招待（v3.0、itinerary-sharing）はこのファイルと同じ形で作る。
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!isInvitableRole(body.role)) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }

  const admin = createAdminClient();
  const role = await getAlbumRole(admin, id, user.id);
  if (!role) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // v3.1（mentoring-7 Task2）: 「日常」には招待できない
  if (await isDailyTrip(admin, id)) {
    return NextResponse.json({ error: "daily_album" }, { status: 400 });
  }

  // v3.2（feedback-0919 Task6）: inviteeUserId があればアプリ内招待（宛先に通知）
  const inviteeUserId = typeof (body as { inviteeUserId?: unknown }).inviteeUserId === "string" ? ((body as { inviteeUserId: string }).inviteeUserId || null) : null;
  if (inviteeUserId) {
    const sent = await sendInAppInvitation(admin, { kind: "album", targetId: id, inviterId: user.id, inviteeId: inviteeUserId, role: body.role });
    if (!sent.ok) {
      const status = sent.error === "insert_failed" ? 500 : sent.error === "invitee_not_found" ? 404 : 409;
      return NextResponse.json({ error: sent.error }, { status });
    }
    return NextResponse.json({ invitation: { id: sent.invitationId, inviteeUserId, role: body.role } }, { status: 201 });
  }

  const issuedAt = new Date();
  const token = generateInvitationToken();
  const { data: invitation, error } = await admin
    .from("album_invitations")
    .insert({
      trip_id: id,
      token,
      role: body.role,
      created_by: user.id,
      expires_at: computeInvitationExpiry(issuedAt).toISOString(),
    })
    .select("id, role, expires_at, created_at")
    .single();

  if (error || !invitation) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json(
    {
      invitation: {
        id: invitation.id,
        role: invitation.role,
        expiresAt: invitation.expires_at,
        createdAt: invitation.created_at,
        path: buildInvitationPath(token),
      },
    },
    { status: 201 }
  );
}

/**
 * 発行済みの招待一覧（オーナーのみ）。SC-09 の招待管理 UI が使う。トークン（URL）は発行時にしか返さない。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const role = await getAlbumRole(admin, id, user.id);
  if (!role) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("album_invitations")
    .select("id, role, expires_at, revoked_at, created_at")
    .eq("trip_id", id)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  const now = new Date();
  const invitations = (data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    status: evaluateInvitation(row, now),
  }));

  return NextResponse.json({ invitations });
}
