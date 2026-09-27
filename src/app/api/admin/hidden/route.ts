import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { listHiddenItems, parseHiddenTab } from "@/lib/admin/hidden-items";

/**
 * user-management Task 3: 非公開にしたものの一覧（管理者のみ）
 * 出典: docs/tasks/admin/user-management/03-hidden-items.md
 *
 * クエリ: tab（auto / admin / suspension）/ offset。非公開になった順に 20 件ずつ
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = await requireAdminUser(supabase, admin);
  if (!user) return new NextResponse(null, { status: 404 });

  const params = new URL(request.url).searchParams;
  const tab = parseHiddenTab(params.get("tab"));
  const offset = Math.max(0, Number.parseInt(params.get("offset") ?? "0", 10) || 0);
  try {
    return NextResponse.json({ tab, ...(await listHiddenItems(admin, tab, offset)) });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
