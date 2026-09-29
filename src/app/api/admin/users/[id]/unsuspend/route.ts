import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { requireStepUp } from "@/lib/admin/require-step-up";
import { unsuspendUser, validateActionNote } from "@/lib/admin/user-actions";

/**
 * user-management Task 2: POST /api/admin/users/[id]/unsuspend
 * 出典: docs/tasks/admin/user-management/02-user-detail-actions.md
 *
 * body: { note: string（必須）, restorePosts?: boolean（既定 false） }
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = await requireAdminUser(supabase, admin);
  if (!user) return new NextResponse(null, { status: 404 });

  let body: { note?: unknown; restorePosts?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const note = validateActionNote(body.note);
  if (!note.ok) return NextResponse.json({ error: note.error }, { status: 400 });

  // admin-login Task 7: 停止の解除は取り消せない・影響が大きいので、直前に 6 桁を求める（要件 3.10.1）。
  // 入力の検証より後ろに置く。6 桁を入れさせたあとで「理由が空です」と返すのは二度手間になるため
  const stepUp = await requireStepUp();
  if (stepUp) return stepUp;

  const { data: target } = await admin.from("users").select("id").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const result = await unsuspendUser(admin, { adminId: user.id, userId: id, note: note.note, restorePosts: typeof body.restorePosts === "boolean" ? body.restorePosts : false });
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: "action_failed" }, { status: 500 });
  }
}
