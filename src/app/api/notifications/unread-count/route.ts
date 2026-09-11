import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

/**
 * 共通メニューバー Task2: 通知の未読件数
 * 出典: docs/tasks/shared-ui/menu-bar/02-unread-notification-badge.md
 *       要件定義書3.9.2（個人向け通知の未読件数）
 *
 * notifications_select_own のRLSにより本人の行しか数えられないため、
 * ユーザースコープのクライアントで問い合わせる。
 * (user_id, is_read) のインデックス（20260908000003）が効くよう、条件はその2列だけにする。
 */
export async function GET() {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  return NextResponse.json({ unreadCount: count ?? 0 });
}
