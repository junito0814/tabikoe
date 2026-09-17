import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getMyDrafts } from "@/lib/posts/drafts";

/**
 * GET /api/users/me/drafts — 自分の下書き一覧（draft Task3）
 * 出典: docs/tasks/posts/draft/03-draft-listing-and-publish.md
 *
 * マイページ（SC-06）の先頭に出す「下書き N 件」の元データ。本人の下書きしか返さない。
 */
export async function GET() {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const page = await getMyDrafts(createAdminClient(), user.id);
    return NextResponse.json(page);
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
