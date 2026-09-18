import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * post-creation-v3 Task4: 動画（MP4／MOV）の受付・変換・サムネイル生成
 * 出典: docs/tasks/posts/post-creation-v3/04-video-mov-support.md
 *       要件定義書 v3.0 3.3.1・5.4（動画は MP4 か iPhone 標準の MOV、100MB・1 分以内、MOV は MP4 に変換）
 *
 * 【初心者向け】動画は sharp（画像ライブラリ）では扱えないので、ffmpeg（コマンドラインの動画処理ツール）を
 * 子プロセスとして起動する。`ffmpeg-static` パッケージが実行ファイルを同梱している。流れは
 *   ①一時ファイルに書く → ②ffmpeg で長さを調べる（1 分超は拒否）→ ③先頭フレームを JPEG で切り出す →
 *   ④MP4 に変換（MOV のとき。MP4 はメタデータだけ除去して再パック）→ ⑤2 つを Storage に上げる → ⑥一時ファイルを消す
 * 位置情報などのメタデータは `-map_metadata -1` で落とす（5.4）。
 *
 * ffmpeg が Vercel のサーバーレス関数で動くかは要件定義書 9 章 #5・#8 の検証事項。動かない場合は
 * `VIDEO_UPLOAD_DISABLED=1` で受付を止められる（呼び出し側で 503 を返す）。
 */
const execFileAsync = promisify(execFile);

export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 60;
import { isVideoFile } from "./media-kind";
export { isVideoFile };

export class VideoValidationError extends Error {}

export interface ProcessedVideoUpload {
  /** サムネイル（先頭フレーム、JPEG）のパス。post_photos.storage_url に入れる */
  thumbnailPath: string;
  /** MP4 本体のパス。post_photos.video_url に入れる */
  videoPath: string;
  durationSeconds: number;
}

export function isVideoUploadDisabled(): boolean {
  return process.env.VIDEO_UPLOAD_DISABLED === "1";
}

async function ffmpegPath(): Promise<string> {
  const mod = (await import("ffmpeg-static")) as unknown as { default?: string } | string;
  const path = typeof mod === "string" ? mod : mod.default;
  if (!path) throw new Error("ffmpeg binary not found");
  return path;
}

/** `ffmpeg -i` の stderr から Duration: HH:MM:SS.ss を読む（ffprobe を同梱しないため） */
export function parseDurationSeconds(ffmpegStderr: string): number | null {
  const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(ffmpegStderr);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

async function probeDuration(ffmpeg: string, inputPath: string): Promise<number> {
  // 出力先を指定せず情報だけ出させる。ffmpeg は非 0 終了するので stderr を拾う
  try {
    await execFileAsync(ffmpeg, ["-hide_banner", "-i", inputPath], { maxBuffer: 4 * 1024 * 1024 });
    return 0;
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? "";
    const duration = parseDurationSeconds(stderr);
    if (duration === null) throw new VideoValidationError("unsupported_format");
    return duration;
  }
}

export async function processAndUploadVideo(
  admin: SupabaseClient,
  bucket: string,
  pathPrefix: string,
  file: File
): Promise<ProcessedVideoUpload> {
  if (!isVideoFile(file)) throw new VideoValidationError("unsupported_format");
  if (file.size > MAX_VIDEO_SIZE_BYTES) throw new VideoValidationError("file_too_large");

  const ffmpeg = await ffmpegPath();
  const workDir = await mkdtemp(join(tmpdir(), "tabikoe-video-"));
  const isMov = file.type === "video/quicktime" || /\.mov$/i.test(file.name);
  const inputPath = join(workDir, isMov ? "input.mov" : "input.mp4");
  const thumbPath = join(workDir, "thumb.jpg");
  const outputPath = join(workDir, "output.mp4");

  try {
    await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));

    const duration = await probeDuration(ffmpeg, inputPath);
    if (duration > MAX_VIDEO_DURATION_SECONDS) throw new VideoValidationError("video_too_long");

    // ③ 先頭フレーム（長辺 1200px）
    await execFileAsync(ffmpeg, ["-hide_banner", "-y", "-ss", "0", "-i", inputPath, "-frames:v", "1", "-vf", "scale='min(1200,iw)':-2", thumbPath]);

    // ④ MOV は H.264/AAC の MP4 に変換。MP4 はコピーで再パック。どちらもメタデータ（位置情報）を除去
    const convertArgs = isMov
      ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart"]
      : ["-c", "copy", "-movflags", "+faststart"];
    await execFileAsync(ffmpeg, ["-hide_banner", "-y", "-i", inputPath, "-map_metadata", "-1", ...convertArgs, outputPath]);

    // ⑤ Storage へ
    const [thumb, video] = await Promise.all([readFile(thumbPath), readFile(outputPath)]);
    const thumbnailPath = `${pathPrefix}-thumb.jpg`;
    const videoPath = `${pathPrefix}.mp4`;
    const [thumbResult, videoResult] = await Promise.all([
      admin.storage.from(bucket).upload(thumbnailPath, thumb, { contentType: "image/jpeg", upsert: false }),
      admin.storage.from(bucket).upload(videoPath, video, { contentType: "video/mp4", upsert: false }),
    ]);
    if (thumbResult.error) throw thumbResult.error;
    if (videoResult.error) throw videoResult.error;

    return { thumbnailPath, videoPath, durationSeconds: Math.round(duration) };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
