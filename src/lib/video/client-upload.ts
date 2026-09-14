import { createClient } from "@/lib/supabase/client";
import { fetchWithAuthRedirect } from "@/lib/api/fetch-with-auth-redirect";
import {
  ALLOWED_VIDEO_EXTENSIONS,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_SIZE_BYTES,
  POST_MEDIA_BUCKET,
} from "@/lib/posts/constants";

/**
 * F-PO-01 動画対応 Task1・Task3: ブラウザ側の動画アップロード
 * 出典: docs/tasks/posts/video-upload/01-video-direct-upload.md
 *
 * 1. POST /api/posts/videos/upload-url で署名付きアップロードURLを受け取る
 * 2. Supabase Storage へ直接アップロード（Vercel の 4.5MB 制限を回避）
 * 3. POST /api/posts/videos で検証・メタデータ除去・サムネイル生成
 * 戻り値はそのまま投稿作成 API の `media` に渡せる形にする。
 */
export interface UploadedVideoMedia {
  mediaType: "video";
  storagePath: string;
  videoPath: string;
  durationSeconds: number;
}

export type VideoClientError =
  | "unsupported_format"
  | "file_too_large"
  | "video_too_long"
  | "upload_failed";

export class VideoUploadError extends Error {
  constructor(public readonly code: VideoClientError) {
    super(code);
  }
}

/**
 * 動画として扱うファイルか。MIME タイプ（video/mp4・video/quicktime）で判定し、
 * Android 等で MIME が空になる場合は拡張子（.mp4/.mov）で補う。サーバー側で実体を再検証する。
 */
export function isVideoFile(file: File): boolean {
  if ((ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(file.type)) return true;
  if (file.type === "") {
    const name = file.name.toLowerCase();
    return ALLOWED_VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext));
  }
  return false;
}

/** ファイル種別・サイズの事前チェック（サーバー側でも実体を再検証する） */
export function validateVideoFile(file: File): VideoClientError | null {
  if (!isVideoFile(file)) return "unsupported_format";
  if (file.size > MAX_VIDEO_SIZE_BYTES) return "file_too_large";
  return null;
}

/**
 * ブラウザで再生時間を読む。100MB を送ってからサーバーで弾かれるのを避けるための事前確認で、
 * 読めない環境では null を返して判定をサーバーに委ねる。
 */
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
      resolve(null);
      return;
    }
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const finish = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      finish(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => finish(null);
    video.src = url;
  });
}

export async function uploadVideo(file: File): Promise<UploadedVideoMedia> {
  const preflight = validateVideoFile(file);
  if (preflight) throw new VideoUploadError(preflight);

  const duration = await readVideoDuration(file);
  if (duration !== null && duration > MAX_VIDEO_DURATION_SECONDS) {
    throw new VideoUploadError("video_too_long");
  }

  const urlResponse = await fetchWithAuthRedirect("/api/posts/videos/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ size: file.size, type: file.type, name: file.name }),
  });
  if (!urlResponse.ok) {
    throw new VideoUploadError(await errorCodeOf(urlResponse, "upload_failed"));
  }
  const { path, token } = (await urlResponse.json()) as { path: string; token: string };

  // MOV は video/quicktime のまま置き、サーバー側の処理で MP4 に変換される
  const { error: uploadError } = await createClient()
    .storage.from(POST_MEDIA_BUCKET)
    .uploadToSignedUrl(path, token, file, {
      contentType: file.type || (file.name.toLowerCase().endsWith(".mov") ? "video/quicktime" : "video/mp4"),
    });
  if (uploadError) throw new VideoUploadError("upload_failed");

  const processResponse = await fetchWithAuthRedirect("/api/posts/videos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!processResponse.ok) {
    throw new VideoUploadError(await errorCodeOf(processResponse, "upload_failed"));
  }
  const { video } = (await processResponse.json()) as { video: UploadedVideoMedia };
  return video;
}

async function errorCodeOf(response: Response, fallback: VideoClientError): Promise<VideoClientError> {
  try {
    const { error } = (await response.json()) as { error?: string };
    if (error === "unsupported_format" || error === "file_too_large" || error === "video_too_long") {
      return error;
    }
  } catch {
    // 本文が JSON でない場合は fallback
  }
  return fallback;
}

export const VIDEO_ERROR_MESSAGES: Record<VideoClientError, string> = {
  unsupported_format: "動画はMP4またはMOV（iPhoneの標準カメラ）形式のみアップロードできます",
  file_too_large: "動画は1点あたり100MB以内にしてください",
  video_too_long: "動画は1分以内のものをアップロードしてください",
  upload_failed: "動画のアップロードに失敗しました",
};
