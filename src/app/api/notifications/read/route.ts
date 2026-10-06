import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

/** 1回に既読化できる件数の上限（一覧は20件ずつなので十分） */
const MAX_IDS = 100;

/**
 * F-NT-02 Task3: 個人向け通知の既読／未読
 * 出典: docs/tasks/notifications/notification-list/03-read-status-badge-sync.md
 *       #711（2026-10-05）・要件定義書 3.9.2・ワイヤーフレーム決定事項 79
 *
 * notifications の UPDATE は authenticated に許していないため service_role で行い、user_id で本人分に限定する。
 *
 * #711 で 3 つの呼ばれ方をするようになった。
 *   1. `{ notificationIds }`        … モーダルを開いたので既読にする
 *   2. `{ notificationIds, read: false }` … 「未読に戻す」
 *   3. `{ all: true }`              … 「すべて既読にする」（**読み込んでいない分も含めて**）
 *
 * #754（2026-10-06）: **お知らせ（system_announcements）にも対応した。**
 *
 * 【初心者向け】お知らせは 1 件を全員で共有するので、行に `is_read` を持てません。
 * 代わりに `announcement_reads`（誰がどれを読んだか）へ**入れる＝既読／消す＝未読**にします。
 * 呼ぶ側は `{ announcementIds }` を渡します（個人向け通知と同時に渡してもよい）。
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { notificationIds?: unknown; announcementIds?: unknown; read?: unknown; all?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = createAdminClient();

  // #711: 「すべて既読にする」。画面に出ている分だけだとバッジが残って混乱するので、本人の未読を全部
  if (body.all === true) {
    const { data, error } = await admin
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
      .select("id");
    if (error) {
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
    // #754: お知らせも全部。公開済みのうち、まだ自分の行が無いものを入れる
    const { data: all } = await admin.from("system_announcements").select("id").lte("published_at", new Date().toISOString());
    const announcementRows = (all ?? []).map((row) => ({ announcement_id: row.id, user_id: user.id }));
    if (announcementRows.length > 0) {
      await admin.from("announcement_reads").upsert(announcementRows, { onConflict: "announcement_id,user_id", ignoreDuplicates: true });
    }
    return NextResponse.json({ updated: data?.length ?? 0 });
  }

  /*
   * #754: お知らせの既読／未読。`read: false` なら行を消す（＝未読に戻す）。
   * 個人向け通知と同時に渡されることもあるので、先に済ませておく。
   */
  const announcementIds = Array.isArray(body.announcementIds)
    ? body.announcementIds.filter((id): id is string => typeof id === "string").slice(0, MAX_IDS)
    : [];
  if (announcementIds.length > 0) {
    if (body.read === false) {
      await admin.from("announcement_reads").delete().eq("user_id", user.id).in("announcement_id", announcementIds);
    } else {
      await admin
        .from("announcement_reads")
        .upsert(announcementIds.map((id) => ({ announcement_id: id, user_id: user.id })), { onConflict: "announcement_id,user_id", ignoreDuplicates: true });
    }
  }

  const ids = Array.isArray(body.notificationIds)
    ? body.notificationIds.filter((id): id is string => typeof id === "string").slice(0, MAX_IDS)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ updated: announcementIds.length });
  }

  // #711: `read: false` なら未読に戻す（既定は既読にする）
  const nextRead = body.read !== false;
  const { data, error } = await admin
    .from("notifications")
    .update({ is_read: nextRead })
    .eq("user_id", user.id)
    .eq("is_read", !nextRead)
    .in("id", ids)
    .select("id");
  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ updated: data?.length ?? 0 });
}
