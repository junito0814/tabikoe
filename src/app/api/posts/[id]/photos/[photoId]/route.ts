import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { removeStorageObjects, renumberPostPhotos } from "@/lib/posts/photos";

/**
 * F-PO-02 Task2: 投稿写真の個別削除
 * 出典: docs/tasks/posts/post-edit/02-media-edit-logic.md
 *
 * 削除できるのは投稿者本人のみ。DBのレコードとStorageの実ファイルの両方を消し、
 * 残った写真のdisplay_orderを振り直す。
 * 写真は1点以上必須（3.3.1）のため、最後の1点は削除させない。
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const { id, photoId } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: post } = await admin
    .from("posts")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!post) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (post.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: photos, error: photosError } = await admin
    .from("post_photos")
    .select("id, storage_url")
    .eq("post_id", id);

  if (photosError) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  const target = photos?.find((photo) => photo.id === photoId);
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if ((photos?.length ?? 0) <= 1) {
    return NextResponse.json({ error: "last_photo" }, { status: 400 });
  }

  const { error: deleteError } = await admin
    .from("post_photos")
    .delete()
    .eq("id", photoId)
    .eq("post_id", id);

  if (deleteError) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  // Storageの削除に失敗しても、DB上は消えているため投稿の整合性は保たれる。
  // 孤立ファイルが残るだけなのでエラーにはしない。
  await removeStorageObjects(admin, [target.storage_url]);

  try {
    await renumberPostPhotos(admin, id);
  } catch {
    return NextResponse.json({ error: "renumber_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
