import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { listAdminUsers, parseUserListQuery } from "@/lib/admin/users";

/**
 * user-management Task 1: 利用者一覧（管理者のみ）
 * 出典: docs/tasks/admin/user-management/01-user-list.md
 *
 * クエリ: q（表示名・メールの部分一致）/ status / sort / offset。20 件ずつ。
 * 【初心者向け】メールは管理者だけが見る情報。requireAdminUser を通らなければ 404（存在も見せない）。
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = await requireAdminUser(supabase, admin);
  if (!user) {
    return new NextResponse(null, { status: 404 });
  }

  const query = parseUserListQuery(new URL(request.url).searchParams);
  try {
    const page = await listAdminUsers(admin, query);
    return NextResponse.json({ query, ...page });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
