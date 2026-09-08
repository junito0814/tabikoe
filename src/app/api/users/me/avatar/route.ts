import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ImageValidationError, processAndUploadImage } from "@/lib/image/process-upload";

/**
 * F-AC-04 Task4: アイコン画像アップロード Route Handler
 * 出典: docs/tasks/account/profile-edit/04-avatar-upload-handler.md
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
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
    uploaded = await processAndUploadImage(admin, "avatars", user.id, file);
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

  return NextResponse.json({ avatarUrl: uploaded.resizedUrl });
}
