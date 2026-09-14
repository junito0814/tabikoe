import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

/** 1回に既読化できる件数の上限（一覧は20件ずつなので十分） */
const MAX_IDS = 100;

/**
 * F-NT-02 Task3: 表示した個人向け通知の既読化
 * 出典: docs/tasks/notifications/notification-list/03-read-status-badge-sync.md
 *
 * notifications テーブルのみを対象にする。お知らせ（system_announcements）は既読管理しないので
 * ID を渡されても無視される（テーブルが違うため更新対象にならない）。
 * notifications の UPDATE は authenticated に許していないため service_role で行い、user_id で本人分に限定する。
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { notificationIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const ids = Array.isArray(body.notificationIds)
    ? body.notificationIds.filter((id): id is string => typeof id === "string").slice(0, MAX_IDS)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  const { data, error } = await createAdminClient()
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false)
    .in("id", ids)
    .select("id");
  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ updated: data?.length ?? 0 });
}
