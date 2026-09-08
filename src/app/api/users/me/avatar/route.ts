import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { ImageValidationError, processAndUploadImage } from "@/lib/image/process-upload";

const AVATAR_BUCKET = "avatars";

/**
 * JPEG→PNGのように形式を変えて再アップロードすると、旧拡張子のファイルが
 * 参照されないまま残るため、今回書き込んだ2ファイル以外を削除する。
 * 失敗してもアップロード自体は成功しているので、エラーは無視する。
 */
async function removeStaleAvatarObjects(
  admin: SupabaseClient,
  userId: string,
  keepPaths: string[]
): Promise<void> {
  const { data: objects } = await admin.storage.from(AVATAR_BUCKET).list(userId);
  if (!objects) {
    return;
  }

  const staleObjects = objects
    .map((object) => `${userId}/${object.name}`)
    .filter((path) => !keepPaths.includes(path));

  if (staleObjects.length > 0) {
    await admin.storage.from(AVATAR_BUCKET).remove(staleObjects);
  }
}

/**
 * F-AC-04 Task4: アイコン画像アップロード Route Handler
 * 出典: docs/tasks/account/profile-edit/04-avatar-upload-handler.md
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("avatar");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }

  // Storageへの保存はService Role Keyで行い、ユーザーごとのフォルダ（user.id）に隔離する
  const admin = createAdminClient();
  let uploaded;
  try {
    uploaded = await processAndUploadImage(admin, AVATAR_BUCKET, user.id, file);
  } catch (error) {
    if (error instanceof ImageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ avatar_url: uploaded.resizedUrl })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  await removeStaleAvatarObjects(admin, user.id, [uploaded.originalPath, uploaded.resizedPath]);

  return NextResponse.json({ avatarUrl: uploaded.resizedUrl });
}
