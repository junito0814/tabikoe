import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { ImageValidationError, processAndUploadImage } from "@/lib/image/process-upload";
import { isVideoFile, isVideoUploadDisabled, processAndUploadVideo, VideoValidationError } from "@/lib/video/process-video";
import { POST_MEDIA_BUCKET } from "@/lib/posts/constants";
import { searchMediaPage } from "@/lib/posts/search-photos";
import { parsePostSearchParams } from "@/lib/posts/search-posts";
import { parseSpotSort } from "@/lib/spots/search-spots";

/**
 * photo-view Task1: 写真・動画の一覧（検索条件つき）
 * 出典: docs/tasks/map-search/photo-view/01-photos-api-search-params.md
 *
 * GET /api/posts/photos?（/api/posts/search と同じ条件）&offset=
 * 投稿の順（並び替え）→ 添付順で 40 点ずつ返す。公開済みのみ。
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const searchParams = new URL(request.url).searchParams;
  const filters = parsePostSearchParams(searchParams);
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  try {
    // v3.1: 検索結果（スポット単位）ではスポットの並び（sort=newest|rating|count）で、1 スポット 5 枚まで
    const page = await searchMediaPage(createAdminClient(), user.id, filters, offset, undefined, parseSpotSort(searchParams.get("sort")));
    return NextResponse.json(page);
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

/**
 * F-PO-01 Task4 / post-creation-v3 Task4: 投稿の写真・動画アップロード
 * 出典: docs/tasks/posts/post-creation/04-media-upload-integration.md
 *       docs/tasks/posts/post-creation-v3/04-video-mov-support.md
 *       要件定義書 v3.0 3.3.1・5.4
 *
 * 【初心者向け】投稿本体（POST /api/posts）より前に呼び、ファイルを Storage に上げて「保存先のパス」だけを返す。
 * 写真は sharp（EXIF 位置情報除去・向き補正・長辺 1200px 縮小）、動画は ffmpeg（先頭フレームのサムネイル・
 * MOV→MP4 変換・メタデータ除去）で処理する。応答の `photos` は v1 互換（写真のパス）、`media` が v3.0 の形。
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
  const media: { mediaType: "photo" | "video"; storagePath: string; videoPath: string | null; durationSeconds: number | null }[] = [];

  for (const [index, file] of files.entries()) {
    // 同一投稿内で衝突しないよう、ユーザーID配下にアップロードごとのIDで分ける
    const pathPrefix = `${user.id}/${crypto.randomUUID()}-${index}`;

    try {
      if (isVideoFile(file)) {
        if (isVideoUploadDisabled()) {
          return NextResponse.json({ error: "video_upload_unavailable" }, { status: 503 });
        }
        const result = await processAndUploadVideo(admin, POST_MEDIA_BUCKET, pathPrefix, file);
        media.push({ mediaType: "video", storagePath: result.thumbnailPath, videoPath: result.videoPath, durationSeconds: result.durationSeconds });
      } else {
        const result = await processAndUploadImage(admin, POST_MEDIA_BUCKET, pathPrefix, file);
        uploaded.push({ storagePath: result.resizedPath });
        media.push({ mediaType: "photo", storagePath: result.resizedPath, videoPath: null, durationSeconds: null });
      }
    } catch (error) {
      if (error instanceof ImageValidationError || error instanceof VideoValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      console.error("[media] upload failed", error);
      return NextResponse.json({ error: "upload_failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ photos: uploaded, media }, { status: 201 });
}
