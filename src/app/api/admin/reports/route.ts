import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { listReports, parseReportFilters } from "@/lib/admin/report-filters";

/**
 * F-AD-04 Task1: 通報一覧・絞り込み（管理者のみ）
 * 出典: docs/tasks/admin/report-list/01-report-list-handler.md
 *
 * クエリ: status / reason / target_type / from / to / offset
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = await requireAdminUser(supabase, admin);
  if (!user) {
    return new NextResponse(null, { status: 404 });
  }

  const searchParams = new URL(request.url).searchParams;
  const filters = parseReportFilters(searchParams);
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  try {
    const page = await listReports(admin, filters, offset);
    return NextResponse.json({ filters, ...page });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
