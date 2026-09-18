/**
 * ブラウザ・サーバー共通: ファイルが動画かどうか（MP4 / MOV）
 * サーバー側の process-video.ts は node:child_process を import するため、ブラウザから使う判定だけをここに分ける。
 */
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);

export function isVideoFile(file: { type: string; name: string }): boolean {
  return VIDEO_TYPES.has(file.type) || /\.(mp4|mov)$/i.test(file.name);
}
