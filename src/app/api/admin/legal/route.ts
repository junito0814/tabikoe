import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { isLegalKind } from "@/lib/legal/legal-documents";
import { listLegalVersionsForAdmin, saveLegalDraft, validateLegalDraftInput } from "@/lib/legal/legal-admin";

/**
 * legal-documents Task 2: GET /api/admin/legal?kind=（版の一覧と同意済み人数）、POST（下書きの作成・更新）
 * 出典: docs/tasks/admin/legal-documents/02-legal-admin-screen.md
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = await requireAdminUser(supabase, admin);
  if (!user) return new NextResponse(null, { status: 404 });
  const kind = new URL(request.url).searchParams.get("kind");
  if (!isLegalKind(kind)) return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  try {
    return NextResponse.json(await listLegalVersionsForAdmin(admin, kind));
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = await requireAdminUser(supabase, admin);
  if (!user) return new NextResponse(null, { status: 404 });

  let body: { kind?: unknown; id?: unknown; version?: unknown; summary?: unknown; body?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!isLegalKind(body.kind)) return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  const validation = validateLegalDraftInput(body);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

  try {
    const result = await saveLegalDraft(admin, { kind: body.kind, id: typeof body.id === "string" ? body.id : null, ...validation.fields });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 409 });
    return NextResponse.json({ ok: true, id: result.id });
  } catch {
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
