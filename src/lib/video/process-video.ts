import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isVideoFile } from "./media-kind";
import { ALLOWED_VIDEO_CODEC, MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_SIZE_BYTES } from "./limits";

export { isVideoFile };

/**
 * post-creation-v3 Task4 / #861: 動画の受付（検査・メタデータ除去・サムネイル）
 * 出典: Issue #861「動画の投稿を有効にする」
 *       要件定義書 5.4（30 秒・50MB・中身が H.264 なら MP4／MOV のどちらでも）
 *
 * 【初心者向け】ここがやること・やらないことがはっきり変わりました（2026-10-09）。
 *
 * ~~MOV を MP4 に変換する~~ → **変換しません。**
 *   変換は 1 分の動画で 60〜75 CPU 秒かかり、Vercel の 60 秒に収まりません（2026-10-07 に実測）。
 *   代わりに「**見る人全員が再生できる形かどうか**」を確かめて、だめなら理由を添えて断ります。
 *
 * **なぜ容器（MP4／MOV）の名前では判断できないのか。**
 *   iPhone は HEVC という形式の映像を `.mp4` にも `.mov` にも書き出します。つまり拡張子は
 *   中身を保証しません。そして **iPhone の Safari は HEVC を再生できる**ので、
 *   「上げた人のブラウザで再生できたか」で判断しても、Android の Chrome で見ている人には
 *   再生できない動画が通ってしまいます。**中身を見るしかありません。**
 *
 * この 1 回の取り回しで 3 つを済ませます（どれも映像には触らないので 0.2 CPU 秒ほど）。
 *   ① 中身のコーデックと長さを調べる（H.264 以外・30 秒超は断る）
 *   ② 入れ物だけ作り直して、位置情報などのメタデータを落とす（`-c copy -map_metadata -1`）
 *   ③ 先頭フレームを JPEG で切り出す
 *
 * ②を譲らない理由: 写真では「撮影場所を除去して保存する」と定めています（要件 5.4）。
 * 動画だけ残すと、利用者への約束が崩れます。iPhone の動画には実際に GPS が入ります。
 */
const execFileAsync = promisify(execFile);

/*
 * 上限は limits.ts にある（ブラウザ側の検査・切り取りの画面からも読むため）。
 * ここから再輸出して、既にこのファイルから読んでいる場所を壊さない。
 */
export { ALLOWED_VIDEO_CODEC, MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_SIZE_BYTES } from "./limits";

export class VideoValidationError extends Error {}

export interface ProcessedVideoUpload {
  /** サムネイル（先頭フレーム、JPEG）のパス。post_photos.storage_url に入れる */
  thumbnailPath: string;
  /** 動画本体のパス。post_photos.video_url に入れる */
  videoPath: string;
  durationSeconds: number;
}

/** 受付を止めているか（本番で動画を出す前に外す。docs/deployment.md） */
export function isVideoUploadDisabled(): boolean {
  return process.env.VIDEO_UPLOAD_DISABLED === "1";
}

async function ffmpegPath(): Promise<string> {
  const mod = (await import("ffmpeg-static")) as unknown as { default?: string } | string;
  const path = typeof mod === "string" ? mod : mod.default;
  if (!path) throw new Error("ffmpeg binary not found");
  return path;
}

/**
 * `ffmpeg -i` が出す情報から、長さと映像のコーデックを読む（純粋関数。約束 13）。
 *
 * 【初心者向け】`ffprobe`（情報を調べる専用の道具）は同梱していないので、`ffmpeg -i` に
 * 出力先を与えず実行したときの「説明文」を読みます。ffmpeg はこのとき 0 以外で終わるので、
 * 呼び出し側は例外の中の stderr を拾います。
 *
 *   Duration: 00:00:12.34, start: 0.000000, bitrate: 1234 kb/s
 *     Stream #0:0(und): Video: h264 (High) (avc1 / 0x31637661), yuv420p, 1920x1080, ...
 *     Stream #0:0(und): Video: hevc (Main) (hvc1 / 0x31637668), yuv420p, 1920x1080, ...
 */
export function parseVideoInfo(ffmpegStderr: string): { durationSeconds: number | null; videoCodec: string | null } {
  const duration = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(ffmpegStderr);
  const codec = /Stream #\d+:\d+(?:\([^)]*\))?:\s*Video:\s*([a-zA-Z0-9_]+)/.exec(ffmpegStderr);
  return {
    durationSeconds: duration ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]) : null,
    videoCodec: codec ? codec[1].toLowerCase() : null,
  };
}

/** 長さと形式の判断（純粋関数。ここだけをテストすれば足りる） */
export function checkVideo(info: { durationSeconds: number | null; videoCodec: string | null }): { ok: true; durationSeconds: number } | { ok: false; error: string } {
  if (info.videoCodec === null || info.durationSeconds === null) return { ok: false, error: "unsupported_format" };
  // 中身で判断する。容器（MP4／MOV）の名前では保証にならない
  if (info.videoCodec !== ALLOWED_VIDEO_CODEC) return { ok: false, error: "unsupported_codec" };
  if (info.durationSeconds > MAX_VIDEO_DURATION_SECONDS) return { ok: false, error: "video_too_long" };
  return { ok: true, durationSeconds: info.durationSeconds };
}

async function probe(ffmpeg: string, inputPath: string): Promise<{ durationSeconds: number | null; videoCodec: string | null }> {
  try {
    const { stderr } = await execFileAsync(ffmpeg, ["-hide_banner", "-i", inputPath], { maxBuffer: 4 * 1024 * 1024 });
    return parseVideoInfo(stderr);
  } catch (error) {
    // 出力先を与えていないので ffmpeg は必ず 0 以外で終わる。説明文は stderr にある
    return parseVideoInfo((error as { stderr?: string }).stderr ?? "");
  }
}

/**
 * 動画を受け取り、検査 → メタデータ除去 → サムネイル → Storage へ。
 *
 * @param body 動画の中身（Storage から降ろしたもの）
 * @param isQuickTime 入れ物が MOV か（ffmpeg に拡張子で中身を推測させるため。判断そのものには使わない）
 */
export async function processAndUploadVideo(
  admin: SupabaseClient,
  bucket: string,
  pathPrefix: string,
  body: Buffer,
  isQuickTime: boolean
): Promise<ProcessedVideoUpload> {
  if (body.byteLength > MAX_VIDEO_SIZE_BYTES) throw new VideoValidationError("file_too_large");

  const ffmpeg = await ffmpegPath();
  const workDir = await mkdtemp(join(tmpdir(), "tabikoe-video-"));
  const inputPath = join(workDir, isQuickTime ? "input.mov" : "input.mp4");
  const thumbPath = join(workDir, "thumb.jpg");
  const outputPath = join(workDir, "output.mp4");

  try {
    await writeFile(inputPath, body);

    const checked = checkVideo(await probe(ffmpeg, inputPath));
    if (!checked.ok) throw new VideoValidationError(checked.error);

    /*
     * 先頭フレーム。0 秒ちょうどは真っ黒なことがあるので少しだけ進めてから取る。
     * 長辺 1200px は写真の縮小画像（5.4）と揃えてある。
     */
    await execFileAsync(ffmpeg, [
      "-hide_banner", "-y",
      "-ss", checked.durationSeconds >= 1 ? "0.5" : "0",
      "-i", inputPath,
      "-frames:v", "1",
      "-vf", "scale='min(1200,iw)':-2",
      thumbPath,
    ]);

    /*
     * 入れ物だけ作り直す。`-c copy` は**映像と音をそのまま写す**という意味で、作り直さないので速い。
     * `-map_metadata -1` で位置情報などのメタデータを落とし、`+faststart` で
     * 再生に必要な情報を先頭へ移す（最後まで落とさなくても再生が始まる）。
     */
    await execFileAsync(ffmpeg, [
      "-hide_banner", "-y",
      "-i", inputPath,
      "-map_metadata", "-1",
      "-c", "copy",
      "-movflags", "+faststart",
      outputPath,
    ]);

    const [thumb, video] = await Promise.all([readFile(thumbPath), readFile(outputPath)]);
    const thumbnailPath = `${pathPrefix}-thumb.jpg`;
    const videoPath = `${pathPrefix}.mp4`;
    const [thumbResult, videoResult] = await Promise.all([
      admin.storage.from(bucket).upload(thumbnailPath, thumb, { contentType: "image/jpeg", upsert: false }),
      admin.storage.from(bucket).upload(videoPath, video, { contentType: "video/mp4", upsert: false }),
    ]);
    if (thumbResult.error) throw thumbResult.error;
    if (videoResult.error) throw videoResult.error;

    return { thumbnailPath, videoPath, durationSeconds: Math.round(checked.durationSeconds) };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
