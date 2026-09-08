import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { ImageValidationError, processAndUploadImage } from "@/lib/image/process-upload";
import { POST_MEDIA_BUCKET } from "@/lib/posts/constants";

/**
 * F-PO-01 Task4: 投稿の写真アップロード
 * 出典: docs/tasks/posts/post-creation/04-media-upload-integration.md
 *       要件定義書3.3.1（ブラウザ→/api/posts/photos→sharp処理→Storage→URLをDBに記録）
 *
 * F-AC-04で実装した共通処理（EXIF位置情報除去・向き補正・長辺1200px縮小）を再利用する。
 * 投稿本体の作成（POST /api/posts）より前に呼び出し、返したパスを投稿作成時に渡す。
 *
 * 動画（MP4・ffmpegでの先頭フレーム抽出）は本エンドポイントの対象外。
 * 要件定義書9章#5「ffmpegのVercelサーバーレス関数上での動作検証」が未了のため、
 * 写真のみ先行して実装している。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData.getAll("photos").filter((file): file is File => file instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "photo_required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const uploaded: { storagePath: string }[] = [];

  for (const [index, file] of files.entries()) {
    // 同一投稿内で衝突しないよう、ユーザーID配下にアップロードごとのIDで分ける
    const pathPrefix = `${user.id}/${crypto.randomUUID()}-${index}`;

    try {
      const result = await processAndUploadImage(admin, POST_MEDIA_BUCKET, pathPrefix, file);
      uploaded.push({ storagePath: result.resizedPath });
    } catch (error) {
      if (error instanceof ImageValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: "upload_failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ photos: uploaded }, { status: 201 });
}
