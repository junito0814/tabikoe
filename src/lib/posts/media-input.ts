/**
 * post-creation-v3 Task1・Task4: 投稿に紐づける写真・動画の入力
 * 出典: docs/tasks/posts/post-creation-v3/01-post-api-validation.md
 *       docs/tasks/posts/post-creation-v3/04-video-mov-support.md
 *
 * 【初心者向け】ファイルは先に POST /api/posts/photos でアップロードし、その結果（保存先のパス）だけを
 * 投稿の作成・更新 API に渡す。v1 は写真のパスの配列（photoPaths）だけだったが、動画は本体とサムネイルの
 * 2 つのパスと再生時間を持つので、`media` という配列でも受けられるようにした。両方を同じ形に揃える。
 */
export interface MediaInput {
  mediaType: "photo" | "video";
  /** 写真の縮小画像、または動画のサムネイル（一覧・詳細で配信する） */
  storagePath: string;
  /** 動画本体（動画のときだけ） */
  videoPath?: string | null;
  durationSeconds?: number | null;
}

export function parseMediaInput(body: { photoPaths?: unknown; media?: unknown }): MediaInput[] {
  const fromMedia = Array.isArray(body.media)
    ? body.media.flatMap((item): MediaInput[] => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        if (typeof record.storagePath !== "string") return [];
        const mediaType = record.mediaType === "video" ? "video" : "photo";
        return [
          {
            mediaType,
            storagePath: record.storagePath,
            videoPath: mediaType === "video" && typeof record.videoPath === "string" ? record.videoPath : null,
            durationSeconds: typeof record.durationSeconds === "number" ? Math.round(record.durationSeconds) : null,
          },
        ];
      })
    : [];
  const fromPhotoPaths = Array.isArray(body.photoPaths)
    ? body.photoPaths
        .filter((path): path is string => typeof path === "string")
        .map((storagePath): MediaInput => ({ mediaType: "photo", storagePath, videoPath: null, durationSeconds: null }))
    : [];
  return [...fromMedia, ...fromPhotoPaths];
}

/** post_photos に INSERT する行に変換する */
export function toPostPhotoRows(postId: string, media: MediaInput[], startOrder = 0) {
  return media.map((item, index) => ({
    post_id: postId,
    media_type: item.mediaType,
    storage_url: item.storagePath,
    video_url: item.videoPath ?? null,
    duration_seconds: item.durationSeconds ?? null,
    display_order: startOrder + index,
  }));
}
