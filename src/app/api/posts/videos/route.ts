import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { POST_MEDIA_BUCKET } from "@/lib/posts/constants";
import { processAndStoreVideo, VideoValidationError } from "@/lib/video/process-video";

/**
 * F-PO-01 動画対応 Task2: アップロード済み動画の検証・処理
 * 出典: docs/tasks/posts/video-upload/02-video-processing-handler.md
 *       要件定義書5.4
 *
 * Task1 で Storage に直接置かれた動画を取り出し、MP4 実体・100MB・1分以内を検証し、
 * 位置情報等のメタデータを除去した動画で上書き、先頭フレームのサムネイルを生成する。
 * 戻り値を投稿作成（POST /api/posts）・写真追加（POST /api/posts/[id]/photos）の
 * `media` に渡す。
 *
 * 100MB のダウンロードと ffmpeg 実行を含むため、既定の実行時間では足りないことがある。
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { path?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const videoPath = body.path;
  // 本人のディレクトリ配下（Task1 が発行した形）以外は処理しない
  if (
    typeof videoPath !== "string" ||
    !videoPath.startsWith(`${user.id}/`) ||
    !videoPath.endsWith("/video.mp4") ||
    videoPath.split("/").includes("..")
  ) {
    return NextResponse.json({ error: "invalid_path" }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    const video = await processAndStoreVideo(admin, POST_MEDIA_BUCKET, videoPath);
    return NextResponse.json(
      {
        video: {
          mediaType: "video",
          storagePath: video.thumbnailPath,
          videoPath: video.videoPath,
          durationSeconds: video.durationSeconds,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof VideoValidationError) {
      const status = error.message === "video_not_found" ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("[videos] processing failed", error);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
