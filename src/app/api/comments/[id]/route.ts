import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { recordOperation } from "@/lib/logs/record-operation";

/**
 * F-VW-03 Task2: コメント削除（本人のみ）
 * 出典: docs/tasks/browsing/comments/02-comment-delete-handler.md
 *
 * 投稿者本人のみ削除できる。投稿の投稿者やアルバムオーナーであっても他人のコメントは消せない（3.5.3）。
 * 編集用のエンドポイントは設けない。削除しても通知は消さない（Task5）。
 * v3.2（feedback-0919 Task4）: 返信がある親は論理削除（deleted_at。「削除されたコメント」の枠が残る）、無ければ物理削除。
 * 返信を消して、枠だけ残っていた親の返信が 0 になったら、その親も物理削除する。
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: comment, error: fetchError } = await admin
    .from("comments")
    .select("id, user_id, post_id, parent_id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  if (!comment) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (comment.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // v3.2: 返信がある親は枠を残す（論理削除）。comments には UPDATE 権限が無いので admin で行う（本人確認は上で済み）
  const { count: replyCount } = await admin.from("comments").select("id", { count: "exact", head: true }).eq("parent_id", id).is("deleted_at", null);
  const keepFrame = (replyCount ?? 0) > 0;
  if (keepFrame) {
    const { error } = await admin.from("comments").update({ deleted_at: new Date().toISOString(), body: "" }).eq("id", id);
    if (error) {
      return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    }
  } else {
    // RLS（comments_owner_write）に従わせるためユーザー権限で削除する
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    }
    // 枠だけ残っていた親の返信が 0 になったら、親も消す（cascade で自分は消えているので親だけ）
    if (comment.parent_id) await removeEmptyDeletedParent(admin, comment.parent_id);
  }

  // 要件7.5: コメントの削除
  await recordOperation(admin, {
    actionType: "comment_delete",
    userId: user.id,
    targetId: id,
    detail: { postId: comment.post_id },
  });

  return NextResponse.json({ deleted: true, keptFrame: keepFrame });
}

/** 論理削除済みの親に生きている返信が無ければ物理削除する（返信の返信の親も順にたどる） */
async function removeEmptyDeletedParent(admin: ReturnType<typeof createAdminClient>, parentId: string): Promise<void> {
  const { data: parent } = await admin.from("comments").select("id, parent_id, deleted_at").eq("id", parentId).maybeSingle();
  if (!parent?.deleted_at) return;
  const { count } = await admin.from("comments").select("id", { count: "exact", head: true }).eq("parent_id", parentId);
  if ((count ?? 0) > 0) return;
  await admin.from("comments").delete().eq("id", parentId);
  if (parent.parent_id) await removeEmptyDeletedParent(admin, parent.parent_id);
}
