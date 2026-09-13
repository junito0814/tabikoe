import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getNotificationFeed } from "@/lib/notifications/feed";

/**
 * F-NT-02 Task1: 通知一覧（個人向け通知＋お知らせ、新着順、20件ページング）
 * 出典: docs/tasks/notifications/notification-list/01-notification-list-api.md
 *
 * related_id の解決（コメント→投稿、通報→対象）で他人の行を読むため service_role で取り、
 * notifications は user_id で本人分に限定する。
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const offset = Math.max(
    0,
    Number.parseInt(new URL(request.url).searchParams.get("offset") ?? "0", 10) || 0
  );

  try {
    const page = await getNotificationFeed(createAdminClient(), user.id, offset);
    return NextResponse.json(page);
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
