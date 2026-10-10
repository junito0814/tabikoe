import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { createNotification } from "@/lib/notifications/create-notification";
import { awardLikeCountBadgeIfEligible, countReceivedLikes } from "@/lib/badges/award-badges";
import { countPostLikes, findLikeTarget } from "@/lib/likes/like-post";

/**
 * F-VW-02 Task1・Task2: いいねの付与（＋通知・いいね数バッジ）
 * 出典: docs/tasks/browsing/likes/01-like-toggle-handler.md
 *       docs/tasks/browsing/likes/02-like-notification-integration.md
 *       docs/tasks/badges/status-badges/03-like-count-badge-evaluation.md
 *
 * (post_id, user_id) の一意制約で重複を防ぎ、二重リクエストはエラーにせず冪等に扱う。
 * 非公開投稿には付けられない（3.5.2・3.3.6）。
 * 通知（投稿者本人のいいねは除く）とバッジ付与の失敗で、いいね自体を失敗させない。
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  let target;
  try {
    target = await findLikeTarget(admin, user.id, id);
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  if (!target.ok) {
    return NextResponse.json({ error: target.error }, { status: target.status });
  }

  // RLS（likes_owner_all）に従わせるためユーザー権限で作成する
  const { error } = await supabase.from("likes").insert({ post_id: id, user_id: user.id });

  let alreadyLiked = false;
  if (error) {
    if (error.code !== "23505") {
      return NextResponse.json({ error: "insert_failed" }, { status: 500 });
    }
    alreadyLiked = true;
  }

  if (!alreadyLiked) {
    // Task2: 投稿者への通知（自分自身のいいねは createNotification 側で除外）
    await createNotification(admin, {
      recipientId: target.post.user_id,
      actorId: user.id,
      type: "like",
      relatedId: id,
    });

    // F-BG Task3: 累計獲得いいね数バッジ。取り消し時は剥奪しない
    try {
      const total = await countReceivedLikes(admin, target.post.user_id);
      await awardLikeCountBadgeIfEligible(admin, target.post.user_id, total);
    } catch (badgeError) {
      // #895: Next.js の内部的な合図（redirect / notFound など）は、記録する前に投げ直す。
      // 握りつぶすと転送が黙って効かなくなる。API の口でも決まりを揃える
      unstable_rethrow(error);
      console.error("[badges] awardLikeCountBadgeIfEligible failed", badgeError);
    }
  }

  let likeCount = 0;
  try {
    likeCount = await countPostLikes(admin, id);
  } catch {
    // 件数は表示用なので取れなくても成功にする
  }

  return NextResponse.json({ liked: true, alreadyLiked, likeCount }, { status: alreadyLiked ? 200 : 201 });
}

/**
 * F-VW-02 Task1: いいねの取り消し。未いいねでもエラーにしない（冪等）
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("likes").delete().eq("post_id", id).eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  let likeCount = 0;
  try {
    likeCount = await countPostLikes(createAdminClient(), id);
  } catch {
    // 同上
  }

  return NextResponse.json({ liked: false, likeCount });
}
