import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { getReportDetail } from "@/lib/admin/report-detail";

/**
 * F-AD-04 Task1: 通報詳細（通報された対象の内容）
 * 出典: docs/tasks/admin/report-list/01-report-list-handler.md
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = await requireAdminUser(supabase, admin);
  if (!user) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const report = await getReportDetail(admin, id);
    if (!report) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ report });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
