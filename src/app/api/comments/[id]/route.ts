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
    .select("id, user_id, post_id")
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

  // RLS（comments_owner_write）に従わせるためユーザー権限で削除する
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  // 要件7.5: コメントの削除
  await recordOperation(admin, {
    actionType: "comment_delete",
    userId: user.id,
    targetId: id,
    detail: { postId: comment.post_id },
  });

  return NextResponse.json({ deleted: true });
}
