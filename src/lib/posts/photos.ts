import type { SupabaseClient } from "@supabase/supabase-js";
import { POST_MEDIA_BUCKET } from "./constants";

/**
 * F-PO-02 Task2: 投稿写真の並び順の整合性を保つ
 * 出典: docs/tasks/posts/post-edit/02-media-edit-logic.md
 *
 * 削除・追加のあとに0から連番へ振り直す。
 */
export async function renumberPostPhotos(
  admin: SupabaseClient,
  postId: string
): Promise<void> {
  const { data: photos, error } = await admin
    .from("post_photos")
    .select("id")
    .eq("post_id", postId)
    .order("display_order", { ascending: true });

  if (error) {
    throw error;
  }

  for (const [index, photo] of (photos ?? []).entries()) {
    const { error: updateError } = await admin
      .from("post_photos")
      .update({ display_order: index })
      .eq("id", photo.id);

    if (updateError) {
      throw updateError;
    }
  }
}

/** 次に採番すべきdisplay_orderを返す。 */
export async function nextDisplayOrder(
  admin: SupabaseClient,
  postId: string
): Promise<number> {
  const { data, error } = await admin
    .from("post_photos")
    .select("display_order")
    .eq("post_id", postId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? data.display_order + 1 : 0;
}

/** Storage上の実ファイルも消す。DBだけ消すと孤立ファイルが残る。 */
export async function removeStorageObjects(
  admin: SupabaseClient,
  paths: (string | null | undefined)[]
): Promise<void> {
  // 写真は storage_url のみ、動画は storage_url（サムネイル）と video_url（本体）の両方を消す
  const targets = paths.filter((path): path is string => typeof path === "string" && path.length > 0);
  if (targets.length === 0) return;
  await admin.storage.from(POST_MEDIA_BUCKET).remove(targets);
}
