// @vitest-environment node
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { transcodeLocalVideo, VideoValidationError } from "./process-video";
import { parseStreamCodecs } from "./mp4";

/**
 * 出典: docs/tasks/posts/video-upload/02-video-processing-handler.md 単体テスト
 *       要件定義書9章#5「ffmpeg の動作検証」— 同梱バイナリ（ffmpeg-static）を実際に起動して確かめる
 *
 * ffmpeg 自身でテスト用の MP4 を生成し（lavfi）、外部ファイルに依存しないようにする。
 * Storage への入出力（processAndStoreVideo）は含まない。
 */
const execFileAsync = promisify(execFile);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpeg = require("ffmpeg-static") as string;

let workDir: string;

async function makeTestVideo(
  name: string,
  seconds: number,
  { withMetadata = false, codec = "libx264" }: { withMetadata?: boolean; codec?: string } = {}
): Promise<string> {
  const output = path.join(workDir, name);
  const metadata = withMetadata
    ? ["-metadata", "location=+35.6812+139.7671/", "-metadata", "title=secret"]
    : [];
  await execFileAsync(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", `testsrc=duration=${seconds}:size=320x240:rate=5`,
    ...metadata,
    "-c:v", codec, "-pix_fmt", "yuv420p",
    ...(codec === "libx265" ? ["-tag:v", "hvc1"] : []),
    output,
  ]);
  return output;
}

/** 処理後ファイルのコーデックを ffmpeg で読む */
async function probeCodecs(filePath: string) {
  try {
    const { stderr } = await execFileAsync(ffmpeg, ["-hide_banner", "-i", filePath]);
    return parseStreamCodecs(stderr);
  } catch (error) {
    return parseStreamCodecs((error as { stderr: string }).stderr);
  }
}

beforeAll(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), "tabikoe-video-test-"));
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("transcodeLocalVideo（ffmpeg-static 実行）", () => {
  it("1分以内の MP4 から、メタデータ除去済み動画と先頭フレームのサムネイルを生成する", async () => {
    const input = await makeTestVideo("ok.mp4", 2, { withMetadata: true });
    const outDir = path.join(workDir, "ok");
    await execFileAsync("mkdir", ["-p", outDir]);

    const result = await transcodeLocalVideo(input, outDir);

    expect(result.durationSeconds).toBe(2);

    // サムネイルは JPEG で、長辺 1200px 以内
    const meta = await sharp(await readFile(result.thumbnailPath)).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(1200);
    expect(meta.width).toBe(320);

    // 処理後の動画に位置情報・タイトルのメタデータが残っていない
    const cleaned = await readFile(result.cleanedPath);
    expect(cleaned.includes("35.6812")).toBe(false);
    expect(cleaned.includes("secret")).toBe(false);
    // 元ファイルには入っていたことの対照
    expect((await readFile(input)).includes("secret")).toBe(true);
  }, 30_000);

  it("iPhone 形式（MOV・HEVC）は H.264 の MP4 に変換される（v2.9）", async () => {
    const input = await makeTestVideo("iphone.mov", 2, { codec: "libx265" });
    expect((await probeCodecs(input)).video).toBe("hevc");
    const outDir = path.join(workDir, "iphone");
    await execFileAsync("mkdir", ["-p", outDir]);

    const result = await transcodeLocalVideo(input, outDir);

    expect(result.cleanedPath.endsWith(".mp4")).toBe(true);
    expect((await probeCodecs(result.cleanedPath)).video).toBe("h264");
    expect((await sharp(await readFile(result.thumbnailPath)).metadata()).format).toBe("jpeg");
  }, 60_000);

  it("H.264 の MP4 は再エンコードせずに済む（コーデックが変わらない）", async () => {
    const input = await makeTestVideo("h264.mp4", 1);
    const outDir = path.join(workDir, "h264");
    await execFileAsync("mkdir", ["-p", outDir]);

    const result = await transcodeLocalVideo(input, outDir);
    expect((await probeCodecs(result.cleanedPath)).video).toBe("h264");
  }, 30_000);

  it("再生時間が1分を超える動画は video_too_long で拒否する", async () => {
    const input = await makeTestVideo("long.mp4", 61);
    const outDir = path.join(workDir, "long");
    await execFileAsync("mkdir", ["-p", outDir]);

    await expect(transcodeLocalVideo(input, outDir)).rejects.toThrow(VideoValidationError);
    await expect(transcodeLocalVideo(input, outDir)).rejects.toThrow("video_too_long");
  }, 60_000);

  it("動画として読めないファイルは unsupported_format で拒否する", async () => {
    const input = path.join(workDir, "broken.mp4");
    await execFileAsync("sh", ["-c", `head -c 4096 /dev/urandom > "${input}"`]);
    const outDir = path.join(workDir, "broken");
    await execFileAsync("mkdir", ["-p", outDir]);

    await expect(transcodeLocalVideo(input, outDir)).rejects.toThrow("unsupported_format");
  }, 30_000);
});
