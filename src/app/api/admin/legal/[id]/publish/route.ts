import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { publishLegalDocument } from "@/lib/legal/legal-admin";

/**
 * legal-documents Task 2: POST /api/admin/legal/[id]/publish（下書きを公開する）
 * 出典: docs/tasks/admin/legal-documents/02-legal-admin-screen.md
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = await requireAdminUser(supabase, admin);
  if (!user) return new NextResponse(null, { status: 404 });
  try {
    const result = await publishLegalDocument(admin, { adminId: user.id, id });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 409 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "publish_failed" }, { status: 500 });
  }
}
