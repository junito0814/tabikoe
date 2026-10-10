import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";
import { ALLOWED_VIDEO_CODEC, checkVideo, isVideoFile, MAX_VIDEO_DURATION_SECONDS, parseVideoInfo } from "./process-video";

/**
 * 出典: Issue #861「動画の投稿を有効にする」単体テスト
 *       要件定義書 5.4（30 秒・50MB・中身が H.264 なら MP4／MOV のどちらでも）
 *
 * 【初心者向け】ここが見ているのは「**見る人全員が再生できる形か**」の判断です。
 *
 * #913（2026-10-10）までは、入力が**手で書いた文字列**だけでした。
 * そのため「テストは緑なのに、実物の ffmpeg の出力は読めていない」状態に気づけませんでした
 * （ffmpeg 6 はストリームの行に `[0x1]` を入れるので、一致しなくなっていた）。
 *
 * いまは**同梱の ffmpeg で実際に動画を作り、その出力をそのまま読ませます**。
 * 手で書いた文字列は「古い版の形でも読める」ことの確認として残しています。
 */
const execFileAsync = promisify(execFile);

async function ffmpegPath(): Promise<string> {
  const mod = (await import("ffmpeg-static")) as unknown as { default?: string } | string;
  const path = typeof mod === "string" ? mod : mod.default;
  if (!path) throw new Error("ffmpeg binary not found");
  return path;
}

/** 出力先を与えずに `ffmpeg -i` を呼び、説明文（stderr）を取る。`process-video.ts` の `probe` と同じ手 */
async function describeFile(path: string): Promise<string> {
  const ffmpeg = await ffmpegPath();
  try {
    const { stderr } = await execFileAsync(ffmpeg, ["-hide_banner", "-i", path], { maxBuffer: 4 * 1024 * 1024 });
    return stderr;
  } catch (error) {
    return (error as { stderr?: string }).stderr ?? "";
  }
}

/** 実物の ffmpeg が出した説明文（`beforeAll` で作る） */
const real: { h264?: string; hevc?: string } = {};

beforeAll(async () => {
  const ffmpeg = await ffmpegPath();
  const workDir = await mkdtemp(join(tmpdir(), "tabikoe-probe-test-"));
  const common = ["-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc=size=160x120:rate=10:duration=3"];
  const h264Path = join(workDir, "h264.mp4");
  const hevcPath = join(workDir, "hevc.mp4");
  await execFileAsync(ffmpeg, [...common, "-c:v", "libx264", "-crf", "40", "-pix_fmt", "yuv420p", h264Path]);
  await execFileAsync(ffmpeg, [...common, "-c:v", "libx265", "-crf", "40", "-pix_fmt", "yuv420p", "-tag:v", "hvc1", hevcPath]);
  real.h264 = await describeFile(h264Path);
  real.hevc = await describeFile(hevcPath);
}, 120000);

describe("実物の ffmpeg の出力を読む（#913）", () => {
  /*
   * 【初心者向け】ここで版番号そのものを見てはいけません。
   *   `ffmpeg-static` が入れてくる実行ファイルは**環境で違います**
   *   （手元の macOS は 6.0、CI の Linux は 7.0.2 でした。実際に CI で赤くなって気づきました）。
   *   大事なのは版番号ではなく「**ストリーム ID の括弧が出る形になっている**」ことなので、
   *   見るのはそちらだけにします。
   */
  it("ストリームの行にストリーム ID の括弧が出る ── #913 で読めなくなっていた形", () => {
    expect(real.h264).toMatch(/Stream #0:0\[0x\d+\]/);
  });

  it("実物の H.264 を読み、サーバーが受け付ける", () => {
    const info = parseVideoInfo(real.h264 ?? "");
    expect(info.videoCodec).toBe("h264");
    expect(info.durationSeconds).toBeCloseTo(3, 1);
    expect(checkVideo(info)).toEqual({ ok: true, durationSeconds: info.durationSeconds });
  });

  it("実物の HEVC を読み、サーバーが断る ── 要件 5.4 の保証を測って示す", () => {
    const info = parseVideoInfo(real.hevc ?? "");
    expect(info.videoCodec).toBe("hevc");
    // 入れ物は .mp4 で、タグも hvc1。**中身を見ないと分からない**ことの実例
    expect(real.hevc).toMatch(/hvc1/);
    expect(checkVideo(info)).toEqual({ ok: false, error: "unsupported_codec" });
  });
});
describe("isVideoFile", () => {
  it("MP4 と MOV（quicktime）だけを動画として扱う", () => {
    expect(isVideoFile(new File([""], "a.mp4", { type: "video/mp4" }))).toBe(true);
    expect(isVideoFile(new File([""], "a.mov", { type: "video/quicktime" }))).toBe(true);
    expect(isVideoFile(new File([""], "a.MOV", { type: "" }))).toBe(true);
    expect(isVideoFile(new File([""], "a.avi", { type: "video/x-msvideo" }))).toBe(false);
    expect(isVideoFile(new File([""], "a.jpg", { type: "image/jpeg" }))).toBe(false);
  });
});

describe("parseVideoInfo（古い版の形でも読める）", () => {
  // ffmpeg 4 系の形（ストリーム ID の括弧が無い）
  const h264 = `
  Duration: 00:00:12.34, start: 0.000000, bitrate: 1234 kb/s
    Stream #0:0(und): Video: h264 (High) (avc1 / 0x31637661), yuv420p, 1920x1080, 1200 kb/s
    Stream #0:1(und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo
`;
  const hevc = `
  Duration: 00:00:08.00, start: 0.000000, bitrate: 9000 kb/s
    Stream #0:0(und): Video: hevc (Main) (hvc1 / 0x31637668), yuv420p, 1920x1080
`;

  it("長さと映像のコーデックを読む", () => {
    expect(parseVideoInfo(h264)).toEqual({ durationSeconds: 12.34, videoCodec: "h264" });
  });

  it("HEVC も読み取れる（読み取れたうえで断る）", () => {
    expect(parseVideoInfo(hevc)).toEqual({ durationSeconds: 8, videoCodec: "hevc" });
  });

  it("時・分をまたいでも秒に直す", () => {
    expect(parseVideoInfo("Duration: 00:01:05.00\n Stream #0:0: Video: h264").durationSeconds).toBe(65);
    expect(parseVideoInfo("Duration: 01:00:00.00\n Stream #0:0: Video: h264").durationSeconds).toBe(3600);
  });

  it("読めないものは null（判断側で断る）", () => {
    expect(parseVideoInfo("これは動画ではありません")).toEqual({ durationSeconds: null, videoCodec: null });
  });
});

describe("checkVideo（受け付けてよいか）", () => {
  it("H.264 で 30 秒以内なら通す", () => {
    expect(checkVideo({ durationSeconds: 29.9, videoCodec: "h264" })).toEqual({ ok: true, durationSeconds: 29.9 });
    expect(checkVideo({ durationSeconds: MAX_VIDEO_DURATION_SECONDS, videoCodec: ALLOWED_VIDEO_CODEC })).toEqual({
      ok: true,
      durationSeconds: MAX_VIDEO_DURATION_SECONDS,
    });
  });

  it("30 秒を超えたら断る（ブラウザ側で切り取ってから上げる）", () => {
    expect(checkVideo({ durationSeconds: 30.01, videoCodec: "h264" })).toEqual({ ok: false, error: "video_too_long" });
  });

  it("HEVC は断る ── 上げた人の iPhone では再生できても、Android の Chrome では見られないため", () => {
    expect(checkVideo({ durationSeconds: 10, videoCodec: "hevc" })).toEqual({ ok: false, error: "unsupported_codec" });
  });

  it("H.264 以外はすべて断る", () => {
    for (const codec of ["vp9", "av1", "mpeg4", "prores"]) {
      expect(checkVideo({ durationSeconds: 10, videoCodec: codec }), codec).toEqual({ ok: false, error: "unsupported_codec" });
    }
  });

  it("中身を読めなかったものも断る（黙って通さない）", () => {
    expect(checkVideo({ durationSeconds: null, videoCodec: "h264" })).toEqual({ ok: false, error: "unsupported_format" });
    expect(checkVideo({ durationSeconds: 10, videoCodec: null })).toEqual({ ok: false, error: "unsupported_format" });
  });

  it("長さより先にコーデックを見る（HEVC で 1 分なら『形式が違う』と言う）", () => {
    // 直せる手が違うので、どちらを伝えるかが大事。形式は設定を変えてもらう、長さは切り取ってもらう
    expect(checkVideo({ durationSeconds: 60, videoCodec: "hevc" })).toEqual({ ok: false, error: "unsupported_codec" });
  });
});
