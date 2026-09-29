import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { isHiddenKind, restoreHiddenItem } from "@/lib/admin/hidden-items";
import { validateActionNote } from "@/lib/admin/user-actions";

/**
 * user-management Task 3: POST /api/admin/hidden/restore（復元。理由必須）
 * 出典: docs/tasks/admin/user-management/03-hidden-items.md
 *
 * body: { kind: "post" | "comment" | "spot" | "trip", id: string, note: string }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = await requireAdminUser(supabase, admin);
  if (!user) return new NextResponse(null, { status: 404 });

  let body: { kind?: unknown; id?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!isHiddenKind(body.kind) || typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }
  const note = validateActionNote(body.note);
  if (!note.ok) return NextResponse.json({ error: note.error }, { status: 400 });

  try {
    const result = await restoreHiddenItem(admin, { adminId: user.id, kind: body.kind, id: body.id, note: note.note });
    if (!result.restored) return NextResponse.json({ error: "not_hidden" }, { status: 409 });
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: "action_failed" }, { status: 500 });
  }
}
