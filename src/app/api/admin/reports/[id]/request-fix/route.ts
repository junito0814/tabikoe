import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { validateActionNote } from "@/lib/admin/user-actions";
import { requestSpotFix } from "@/lib/moderation/spot-fix";

/**
 * strike-system Task 6: POST /api/admin/reports/[id]/request-fix（登録者に修正を依頼する）
 * 出典: docs/tasks/safety/strike-system/06-spot-fix-request.md
 *
 * body: { note: string（必須。登録者への依頼の内容） }
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = await requireAdminUser(supabase, admin);
  if (!user) return new NextResponse(null, { status: 404 });

  let body: { note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const note = validateActionNote(body.note);
  if (!note.ok) return NextResponse.json({ error: note.error }, { status: 400 });

  try {
    const result = await requestSpotFix(admin, { adminId: user.id, reportId: id, note: note.note });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 409 });
    return NextResponse.json({ ok: true, status: "in_review" });
  } catch {
    return NextResponse.json({ error: "action_failed" }, { status: 500 });
  }
}
