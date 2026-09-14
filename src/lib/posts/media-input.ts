/**
 * F-PO-01 動画対応 Task3: 投稿に紐づけるメディア指定の検証（作成・編集で共用）
 * 出典: docs/tasks/posts/video-upload/03-post-media-integration.md
 *
 * 写真は POST /api/posts/photos、動画は POST /api/posts/videos が先に処理し、
 * その戻り値（Storage 上のパス）をここで受け取って post_photos の行に変換する。
 *
 * 旧形式 `photoPaths: string[]`（写真のみ）も引き続き受け付ける。
 */
export interface MediaInputItem {
  mediaType: "photo" | "video";
  /** 写真の縮小画像、または動画のサムネイル（post_photos.storage_url） */
  storagePath: string;
  /** 動画本体（post_photos.video_url）。写真は null */
  videoPath: string | null;
  durationSeconds: number | null;
}

export type MediaInputError =
  | "media_required"
  | "invalid_media"
  | "media_path_not_owned";

export type MediaInputResult =
  | { ok: true; items: MediaInputItem[] }
  | { ok: false; error: MediaInputError };

function isOwnedPath(path: string, userId: string): boolean {
  // Storage 上のパスは <userId>/<uuid>/... で始める規則。他人のファイルや
  // ディレクトリトラバーサル（".."）を投稿に紐づけられないようにする
  return path.startsWith(`${userId}/`) && !path.split("/").includes("..");
}

export function parseMediaInput(
  body: { photoPaths?: unknown; media?: unknown },
  userId: string
): MediaInputResult {
  const items: MediaInputItem[] = [];

  if (Array.isArray(body.media)) {
    for (const raw of body.media) {
      if (typeof raw !== "object" || raw === null) return { ok: false, error: "invalid_media" };
      const item = raw as Record<string, unknown>;
      const storagePath = item.storagePath;
      if (typeof storagePath !== "string" || storagePath.length === 0) {
        return { ok: false, error: "invalid_media" };
      }

      if (item.mediaType === "video") {
        const videoPath = item.videoPath;
        const durationSeconds = item.durationSeconds;
        if (typeof videoPath !== "string" || videoPath.length === 0) {
          return { ok: false, error: "invalid_media" };
        }
        if (
          typeof durationSeconds !== "number" ||
          !Number.isInteger(durationSeconds) ||
          durationSeconds < 0
        ) {
          return { ok: false, error: "invalid_media" };
        }
        items.push({ mediaType: "video", storagePath, videoPath, durationSeconds });
      } else if (item.mediaType === "photo" || item.mediaType === undefined) {
        items.push({ mediaType: "photo", storagePath, videoPath: null, durationSeconds: null });
      } else {
        return { ok: false, error: "invalid_media" };
      }
    }
  }

  if (Array.isArray(body.photoPaths)) {
    for (const path of body.photoPaths) {
      if (typeof path !== "string") continue;
      items.push({ mediaType: "photo", storagePath: path, videoPath: null, durationSeconds: null });
    }
  }

  if (items.length === 0) return { ok: false, error: "media_required" };

  for (const item of items) {
    if (!isOwnedPath(item.storagePath, userId)) return { ok: false, error: "media_path_not_owned" };
    if (item.videoPath !== null && !isOwnedPath(item.videoPath, userId)) {
      return { ok: false, error: "media_path_not_owned" };
    }
  }

  return { ok: true, items };
}

/** post_photos に INSERT する行へ変換する */
export function toPostPhotoRows(postId: string, items: MediaInputItem[], startOrder = 0) {
  return items.map((item, index) => ({
    post_id: postId,
    media_type: item.mediaType,
    storage_url: item.storagePath,
    video_url: item.videoPath,
    duration_seconds: item.durationSeconds,
    display_order: startOrder + index,
  }));
}
