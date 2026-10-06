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

  /*
   * #754（2026-10-06）: お知らせ（system_announcements）の未読も数える。
   *
   * 【初心者向け】お知らせは **1 件を全員で共有**するので、「自分が読んだ数」を別の表
   * （`announcement_reads`）に持っている。**公開済みの総数 − 自分が読んだ数**が未読の数。
   */
  const now = new Date().toISOString();
  const [personal, announcements, reads] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false),
    supabase.from("system_announcements").select("id", { count: "exact", head: true }).lte("published_at", now),
    supabase.from("announcement_reads").select("announcement_id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  if (personal.error) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  /*
   * 【初心者向け】`announcement_reads` はマイグレーションで足したばかりなので、
   * **まだ当てていない環境**では存在しません。そのときはお知らせの分を 0 にして、
   * 今までどおり個人向け通知だけ数えます（バッジが出ないだけで、画面は壊れません）。
   *
   * **見分け方**: 表が無いとき、利用者の鍵で引くと `error` は付かず **`count` が `null`**
   * で返ります（204。実際に確かめた）。`0` と `null` は意味が違う ── `0` は「1 つも読んでいない」、
   * `null` は「**数えられなかった**」。数えられないときは一覧の側も「全部既読」として扱うので、
   * ここも 0 にして食い違わせません。
   */
  const cannotCount = announcements.error !== null || reads.error !== null || announcements.count === null || reads.count === null;
  const unreadAnnouncements = cannotCount ? 0 : Math.max(0, (announcements.count ?? 0) - (reads.count ?? 0));
  return NextResponse.json({ unreadCount: (personal.count ?? 0) + unreadAnnouncements });
}
