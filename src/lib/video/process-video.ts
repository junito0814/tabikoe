import { execFile } from "node:child_process";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_SIZE_BYTES } from "@/lib/posts/constants";
import {
  hasVideoStream,
  isMp4Header,
  needsAudioReencode,
  needsVideoReencode,
  parseFfmpegDuration,
  parseStreamCodecs,
} from "./mp4";

const execFileAsync = promisify(execFile);

/**
 * F-PO-01 動画対応 Task2: 動画の検証・メタデータ除去・サムネイル生成
 * 出典: docs/tasks/posts/video-upload/02-video-processing-handler.md
 *       要件定義書5.4（MP4のみ／100MB／1分以内／先頭フレーム抽出／位置情報メタデータ除去）
 *
 * Vercel の Route Handler はリクエスト本文が 4.5MB までのため、動画本体はブラウザから
 * Supabase Storage へ署名付きURLで直接アップロードし（Task1）、本関数は Storage 上の
 * ファイルを取り出して処理し、処理済みの動画で上書きする。
 *
 * 入力は MP4 に加えて iPhone 標準カメラの MOV（QuickTime・HEVC）も受け付け、常に
 * 「MP4 コンテナ・H.264・AAC」に揃えて保存する（v2.9）。既に H.264/AAC なら再エンコードせず
 * コンテナ変換とメタデータ除去だけ行う。HEVC 等はブラウザ横断で再生できないため再エンコードする。
 *
 * ffmpeg は `ffmpeg-static` の同梱バイナリを子プロセスとして実行する（fluent-ffmpeg 等の
 * ラッパーは使わない。呼び出しが2種類しかなく、依存を増やす理由がない）。
 */
export class VideoValidationError extends Error {}

export interface ProcessedVideo {
  /** 先頭フレームのサムネイル（JPEG）。post_photos.storage_url に入れる */
  thumbnailPath: string;
  /** メタデータ除去済みの動画本体。post_photos.video_url に入れる */
  videoPath: string;
  durationSeconds: number;
}

/** サムネイルの長辺（写真の縮小画像と同じ 1200px、5.4） */
const THUMBNAIL_MAX_DIMENSION_PX = 1200;

/** 再エンコード時の長辺上限。サーバーレスでの処理時間を抑えるため 1280px（HD）に落とす */
const REENCODE_MAX_DIMENSION_PX = 1280;

/**
 * 作業ディレクトリ内の出力を読む。`readFile(動的パス)` は Next.js のファイルトレースが
 * 「プロジェクト全体を同梱」と判断して警告するため、FileHandle 経由で読む。
 */
async function readOutput(filePath: string): Promise<Buffer> {
  const handle = await open(filePath, "r");
  try {
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

function ffmpegBinaryPath(): string {
  // serverExternalPackages で外部化しているため、ここで require するとビルド後も
  // node_modules/ffmpeg-static/ffmpeg の実パスが返る（next.config で trace に含めている）
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const binary = require("ffmpeg-static") as string | null;
  if (!binary) {
    throw new Error("ffmpeg-static binary is not available on this platform");
  }
  return binary;
}

/** `ffmpeg -i input` は出力先が無いので終了コード1で落ちるが、必要なのは stderr の情報だけ */
async function probe(ffmpeg: string, inputPath: string): Promise<string> {
  try {
    const { stderr } = await execFileAsync(ffmpeg, ["-hide_banner", "-i", inputPath], {
      maxBuffer: 4 * 1024 * 1024,
    });
    return stderr;
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr;
    if (typeof stderr === "string" && stderr.length > 0) return stderr;
    throw error;
  }
}

/**
 * ローカルファイルを検証し、メタデータ除去済み動画とサムネイルを同じ作業ディレクトリに書き出す。
 * 戻り値は書き出したファイルのパスと再生時間。
 */
export async function transcodeLocalVideo(
  inputPath: string,
  workDir: string
): Promise<{ cleanedPath: string; thumbnailPath: string; durationSeconds: number }> {
  const ffmpeg = ffmpegBinaryPath();

  const info = await probe(ffmpeg, inputPath);
  const duration = parseFfmpegDuration(info);
  if (duration === null || !hasVideoStream(info)) {
    throw new VideoValidationError("unsupported_format");
  }
  if (duration > MAX_VIDEO_DURATION_SECONDS) {
    throw new VideoValidationError("video_too_long");
  }

  // 位置情報等のメタデータをコンテナ・各ストリームから除去し、MP4 コンテナで書き出す。
  // H.264/AAC ならストリームはそのまま（-c copy）、それ以外（iPhone の HEVC 等）は
  // ブラウザ横断で再生できる H.264/AAC に再エンコードする。
  // +faststart で moov を先頭に移し、ブラウザで再生開始が早くなるようにする
  const codecs = parseStreamCodecs(info);
  const videoArgs = needsVideoReencode(codecs.video)
    ? [
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p",
        // 縦横どちらが長辺でも 1280px 以内に収める（回転情報は自動で画素に反映される）
        "-vf", `scale='if(gt(iw,ih),min(iw,${REENCODE_MAX_DIMENSION_PX}),-2)':'if(gt(iw,ih),-2,min(ih,${REENCODE_MAX_DIMENSION_PX}))'`,
      ]
    : ["-c:v", "copy"];
  const audioArgs = needsAudioReencode(codecs.audio)
    ? ["-c:a", "aac", "-b:a", "128k"]
    : ["-c:a", "copy"];

  const cleanedPath = path.join(workDir, "cleaned.mp4");
  await execFileAsync(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", inputPath,
    "-map_metadata", "-1",
    "-map_metadata:s:v", "-1",
    "-map_metadata:s:a", "-1",
    ...videoArgs,
    ...audioArgs,
    "-movflags", "+faststart",
    "-f", "mp4",
    cleanedPath,
  ]);

  // 先頭フレームを1枚だけ書き出し、sharp で長辺1200pxに揃える（写真と同じ規則）
  const rawFramePath = path.join(workDir, "frame.jpg");
  await execFileAsync(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", inputPath,
    "-frames:v", "1",
    "-q:v", "2",
    rawFramePath,
  ]);
  const thumbnailPath = path.join(workDir, "thumbnail.jpg");
  await sharp(await readOutput(rawFramePath))
    .resize({
      width: THUMBNAIL_MAX_DIMENSION_PX,
      height: THUMBNAIL_MAX_DIMENSION_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg()
    .toFile(thumbnailPath);

  return { cleanedPath, thumbnailPath, durationSeconds: Math.round(duration) };
}

/**
 * Storage 上の動画（署名付きURLで直接アップロードされたもの）を検証・処理し、
 * 処理済み動画で上書き、サムネイルを隣に保存する。
 * 検証に失敗した場合はアップロードされたファイルを消してから例外を投げる。
 */
export async function processAndStoreVideo(
  admin: SupabaseClient,
  bucket: string,
  videoPath: string
): Promise<ProcessedVideo> {
  const { data: blob, error: downloadError } = await admin.storage.from(bucket).download(videoPath);
  if (downloadError || !blob) {
    throw new VideoValidationError("video_not_found");
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const reject = async (code: string) => {
    await admin.storage.from(bucket).remove([videoPath]);
    throw new VideoValidationError(code);
  };

  if (buffer.byteLength > MAX_VIDEO_SIZE_BYTES) await reject("file_too_large");
  if (!isMp4Header(buffer.subarray(0, 64))) await reject("unsupported_format");

  const workDir = await mkdtemp(path.join(tmpdir(), "tabikoe-video-"));
  try {
    // 拡張子は判定に使わない（MOV でも ffmpeg は中身で読む）
    const inputPath = path.join(workDir, "input.video");
    await writeFile(inputPath, buffer);

    let result;
    try {
      result = await transcodeLocalVideo(inputPath, workDir);
    } catch (error) {
      if (error instanceof VideoValidationError) await reject(error.message);
      throw error;
    }

    const thumbnailStoragePath = `${path.posix.dirname(videoPath)}/thumbnail.jpg`;
    const [{ error: videoError }, { error: thumbError }] = await Promise.all([
      admin.storage
        .from(bucket)
        .upload(videoPath, await readOutput(result.cleanedPath), { contentType: "video/mp4", upsert: true }),
      admin.storage
        .from(bucket)
        .upload(thumbnailStoragePath, await readOutput(result.thumbnailPath), { contentType: "image/jpeg", upsert: true }),
    ]);
    if (videoError) throw videoError;
    if (thumbError) throw thumbError;

    return { thumbnailPath: thumbnailStoragePath, videoPath, durationSeconds: result.durationSeconds };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
