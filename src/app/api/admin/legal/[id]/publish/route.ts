import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { requireStepUp } from "@/lib/admin/require-step-up";
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

  // admin-login Task 7: 規約の公開は取り消せない・影響が大きいので、直前に 6 桁を求める（要件 3.10.1）
  const stepUp = await requireStepUp();
  if (stepUp) return stepUp;
  try {
    const result = await publishLegalDocument(admin, { adminId: user.id, id });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 409 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "publish_failed" }, { status: 500 });
  }
}
