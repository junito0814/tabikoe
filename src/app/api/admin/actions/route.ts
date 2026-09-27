import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { listAdminActions, parseAdminActionFilters } from "@/lib/admin/admin-actions";

/**
 * user-management Task 4: 操作の記録の一覧（管理者のみ）
 * 出典: docs/tasks/admin/user-management/04-admin-actions-log.md
 *
 * クエリ: actor（管理者の ID か "auto"）/ action / from / to / offset。新しい順に 20 件ずつ
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = await requireAdminUser(supabase, admin);
  if (!user) {
    return new NextResponse(null, { status: 404 });
  }

  const searchParams = new URL(request.url).searchParams;
  const filters = parseAdminActionFilters(searchParams);
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  try {
    const page = await listAdminActions(admin, filters, offset);
    return NextResponse.json({ filters, ...page });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
