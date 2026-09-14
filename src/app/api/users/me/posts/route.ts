import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getMyPosts } from "@/lib/users/my-page";

/**
 * F-RC-01 Task3: 自分の投稿一覧（新着順・非公開含む・旅行で絞り込み）
 * 出典: docs/tasks/records/my-page/03-my-posts-list-handler.md
 *
 * 各投稿に旅行タイトルを含める（マイページは旅行タイトルを表示してよい画面。trip-title Task5）。
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const tripId = searchParams.get("trip_id")?.trim() || null;
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  try {
    const page = await getMyPosts(createAdminClient(), user.id, tripId, offset);
    return NextResponse.json(page);
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
