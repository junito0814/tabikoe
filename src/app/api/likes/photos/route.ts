import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getLikedMediaPage } from "@/lib/likes/liked-posts";
import { parseListSort } from "@/lib/records/list-sort";

/**
 * #954: いいねした投稿（SC-34）の「写真」側 API
 * 出典: Issue #954、要件定義書 3.6.6
 *
 * GET /api/likes/photos?sort=newest|oldest&offset=
 * **本人のぶんだけ**を返す（ログインしている人の `user_id` で引く。他人のいいねは見られない）。
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const searchParams = new URL(request.url).searchParams;
  const sort = parseListSort(searchParams.get("sort"));
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  try {
    return NextResponse.json(await getLikedMediaPage(createAdminClient(), user.id, sort, offset));
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
