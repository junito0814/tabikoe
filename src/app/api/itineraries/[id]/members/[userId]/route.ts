import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications/create-notification";
import { authorizeItinerary, isErrorResponse } from "@/lib/itineraries/route-helpers";

/**
 * itinerary-sharing Task2: メンバーの削除（オーナーのみ）と退出（本人）
 * 出典: docs/tasks/itinerary/itinerary-sharing/02-members-and-notifications.md
 *
 * DELETE /api/itineraries/[id]/members/[userId]   オーナーが他のメンバーを外す → 本人へ itinerary_member_removed 通知
 * DELETE /api/itineraries/[id]/members/me         自分が退出する（オーナーは退出できない。しおりを削除するか、先に譲る）
 *
 * 【初心者向け】`me` は「自分」を表す特別な値。URL に自分の ID を書かせない方が扱いやすく、
 * 「自分を外す＝退出」を明示できる。
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId: target } = await params;

  if (target === "me") {
    const context = await authorizeItinerary(id, "view");
    if (isErrorResponse(context)) return context;
    if (context.role === "owner") {
      return NextResponse.json({ error: "owner_cannot_leave" }, { status: 409 });
    }
    const { error } = await context.admin.from("itinerary_members").delete().eq("itinerary_id", id).eq("user_id", context.userId);
    if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    return NextResponse.json({ ok: true, left: true });
  }

  const context = await authorizeItinerary(id, "manage_members");
  if (isErrorResponse(context)) return context;
  if (target === context.userId) {
    return NextResponse.json({ error: "cannot_remove_self" }, { status: 400 });
  }
  const { data: removed, error } = await context.admin
    .from("itinerary_members")
    .delete()
    .eq("itinerary_id", id)
    .eq("user_id", target)
    .eq("role", "member")
    .select("user_id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  if (!removed) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await createNotification(context.admin, { recipientId: target, actorId: context.userId, type: "itinerary_member_removed", relatedId: id });
  return NextResponse.json({ ok: true });
}
