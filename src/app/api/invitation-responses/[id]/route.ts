import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { respondToInvitation, type InvitationKind } from "@/lib/invitations/in-app";

/**
 * feedback-0919 Task6（v3.2）: POST /api/invitation-responses/[id] { kind: "album" | "itinerary", action: "accept" | "decline" }
 * 出典: docs/tasks/shared-ui/feedback-0919/06-in-app-invite.md
 *
 * 【初心者向け】通知一覧の「参加する」「辞退」から呼ぶ。宛先本人だけ（403）。回答済み・取り消し済みは 409、期限切れは 410。
 * 受諾はリンク招待と同じ処理（lib/invitations/in-app.ts）。
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { kind?: unknown; action?: unknown } | null;
  const kind = body?.kind === "album" || body?.kind === "itinerary" ? (body.kind as InvitationKind) : null;
  const action = body?.action === "accept" || body?.action === "decline" ? body.action : null;
  if (!kind || !action) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  try {
    const result = await respondToInvitation(createAdminClient(), { kind, invitationId: id, userId: user.id, action });
    if (!result.ok) {
      const status = result.error === "not_found" ? 404 : result.error === "forbidden" ? 403 : result.error === "not_pending" ? 409 : result.error === "expired" ? 410 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ ...result, href: kind === "album" ? `/albums/${result.targetId}` : `/itineraries/${result.targetId}` });
  } catch {
    return NextResponse.json({ error: "respond_failed" }, { status: 500 });
  }
}
