import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import {
  ALLOWED_VIDEO_MIME_TYPE,
  MAX_VIDEO_SIZE_BYTES,
  POST_MEDIA_BUCKET,
} from "@/lib/posts/constants";

/**
 * F-PO-01 動画対応 Task1: 動画の直接アップロード用URLの発行
 * 出典: docs/tasks/posts/video-upload/01-video-direct-upload.md
 *
 * Vercel の Route Handler はリクエスト本文が 4.5MB までで、100MB の動画本体は通せない。
 * そのため動画だけは Supabase Storage の署名付きアップロードURLを発行し、ブラウザから
 * 直接 Storage へ送らせる。URL は本人のディレクトリ配下（<userId>/<uuid>/video.mp4）に
 * 限定して発行し、有効期限は Storage 側の既定（2時間）に任せる。
 *
 * アップロード完了後は POST /api/posts/videos で検証・処理を行う（それまで投稿には紐づかない）。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { size?: unknown; type?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // 実体の検証は処理時（Task2）に行う。ここでは明らかに規則外のものを早期に弾くだけ
  if (typeof body.size !== "number" || body.size <= 0 || body.size > MAX_VIDEO_SIZE_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }
  if (body.type !== ALLOWED_VIDEO_MIME_TYPE) {
    return NextResponse.json({ error: "unsupported_format" }, { status: 400 });
  }

  const admin = createAdminClient();
  const videoPath = `${user.id}/${crypto.randomUUID()}/video.mp4`;
  const { data, error } = await admin.storage
    .from(POST_MEDIA_BUCKET)
    .createSignedUploadUrl(videoPath);

  if (error || !data) {
    return NextResponse.json({ error: "upload_url_failed" }, { status: 500 });
  }

  return NextResponse.json({ path: data.path, token: data.token }, { status: 201 });
}
