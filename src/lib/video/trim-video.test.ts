import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";
import { checkVideo, parseVideoInfo } from "./process-video";
import { planTrim, TRIM_WINDOW_SECONDS } from "./trim-plan";
import { loadVideoForTrim, trimVideo, TrimError } from "./trim-video";

/**
 * #861 / 要件 4.5.17（2026-10-10）: 切り取りを**本物の MP4 で**確かめる。
 *
 * 【初心者向け】なぜ本物を使うのか。
 *   切り取りは「MP4 の中身を読んで組み直す」処理です。作り物の入力では、
 *   キーフレームの位置・音の刻み・回転の情報といった**間違えやすいところ**が出てきません。
 *   ここでは ffmpeg（`ffmpeg-static`。サーバー側でも使っているもの）で
 *   40 秒の動画をその場で作り、切り取った結果をまた ffmpeg に読ませて測ります。
 *
 * 判定には**サーバーと同じ** `parseVideoInfo` / `checkVideo` を使います。
 * 「手元では通るがサーバーが断る」を見逃さないためです（約束 14）。
 */
const execFileAsync = promisify(execFile);

async function ffmpegPath(): Promise<string> {
  const mod = (await import("ffmpeg-static")) as unknown as { default?: string } | string;
  const path = typeof mod === "string" ? mod : mod.default;
  if (!path) throw new Error("ffmpeg binary not found");
  return path;
}

/** 出力先を与えずに `ffmpeg -i` を呼び、説明文（stderr）を読む。サーバーの `probe` と同じ手 */
async function probe(path: string) {
  const ffmpeg = await ffmpegPath();
  try {
    const { stderr } = await execFileAsync(ffmpeg, ["-hide_banner", "-i", path], { maxBuffer: 4 * 1024 * 1024 });
    return { stderr, ...parseVideoInfo(stderr) };
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? "";
    return { stderr, ...parseVideoInfo(stderr) };
  }
}

let workDir = "";
/** 40 秒・160×120・H.264 ＋ AAC。キーフレームは 2 秒ごと（`-g 20` ＝ 10fps × 2 秒） */
let plain: File;
/** 上と同じ中身に「90 度回転」を書き込んだもの（iPhone の縦撮りに相当） */
let rotated: File;

async function encodeFixtures() {
  const ffmpeg = await ffmpegPath();
  const plainPath = join(workDir, "plain.mp4");
  const rotatedPath = join(workDir, "rotated.mp4");
  await execFileAsync(ffmpeg, [
    "-hide_banner", "-y",
    "-f", "lavfi", "-i", "testsrc=size=160x120:rate=10:duration=40",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=40",
    "-c:v", "libx264", "-g", "20", "-crf", "40", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "24k", "-ac", "1", "-ar", "22050",
    "-movflags", "+faststart", "-t", "40", plainPath,
  ]);
  await execFileAsync(ffmpeg, ["-hide_banner", "-y", "-i", plainPath, "-c", "copy", "-metadata:s:v:0", "rotate=90", rotatedPath]);
  const toFile = async (path: string, name: string) => {
    const bytes = await readFile(path);
    return new File([new Uint8Array(bytes)], name, { type: "video/mp4" });
  };
  plain = await toFile(plainPath, "plain.mp4");
  rotated = await toFile(rotatedPath, "rotated.mp4");
}

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "tabikoe-trim-test-"));
  await encodeFixtures();
}, 120000);

/** 切り取った結果をファイルに落として ffmpeg に読ませる */
async function probeTrimmed(output: File, name: string) {
  const path = join(workDir, name);
  await writeFile(path, Buffer.from(await output.arrayBuffer()));
  return probe(path);
}

describe("loadVideoForTrim", () => {
  it("長さとキーフレームの位置を読む", async () => {
    const loaded = await loadVideoForTrim(plain);
    expect(loaded.durationSeconds).toBeCloseTo(40, 1);
    expect(loaded.width).toBe(160);
    expect(loaded.height).toBe(120);
    // 2 秒ごと ＝ 40 秒で 20 個
    expect(loaded.keyframeTimes.length).toBe(20);
    // 間隔が 2 秒（先頭は B フレームのぶん 0.2 秒ずれる）
    expect(loaded.keyframeTimes[2] - loaded.keyframeTimes[1]).toBeCloseTo(2, 1);
  });

  it("MP4 でないものは「この端末では切り取れない」として扱う", async () => {
    const notVideo = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], "a.mp4", { type: "video/mp4" });
    await expect(loadVideoForTrim(notVideo)).rejects.toBeInstanceOf(TrimError);
  });
});

describe("trimVideo", () => {
  it("30 秒を超えない ── サーバーの検査（checkVideo）を通る", async () => {
    const loaded = await loadVideoForTrim(plain);
    const range = planTrim({ keyframeTimes: loaded.keyframeTimes, durationSeconds: loaded.durationSeconds, wantStartSeconds: 11 });
    const output = await trimVideo(loaded, range);
    const info = await probeTrimmed(output, "out.mp4");

    expect(info.durationSeconds).not.toBeNull();
    expect(info.durationSeconds!).toBeLessThanOrEqual(TRIM_WINDOW_SECONDS);
    // 1 コマぶんより短くはならない
    expect(info.durationSeconds!).toBeGreaterThan(TRIM_WINDOW_SECONDS - 0.5);
    // サーバーが受け付けるか（ここが赤なら、切り取れても投稿できない）
    expect(checkVideo(info)).toEqual({ ok: true, durationSeconds: info.durationSeconds });
  }, 60000);

  it("作り直さない ── 映像は H.264 のまま、音も残る", async () => {
    const loaded = await loadVideoForTrim(plain);
    const range = planTrim({ keyframeTimes: loaded.keyframeTimes, durationSeconds: loaded.durationSeconds, wantStartSeconds: 0 });
    const info = await probeTrimmed(await trimVideo(loaded, range), "out-codec.mp4");

    expect(info.videoCodec).toBe("h264");
    expect(info.stderr).toMatch(/Audio:\s*aac/);
    expect(info.stderr).toMatch(/160x120/);
  }, 60000);

  it("回転の情報を保つ ── 縦撮りが横向きになってはいけない", async () => {
    const loaded = await loadVideoForTrim(rotated);
    const range = planTrim({ keyframeTimes: loaded.keyframeTimes, durationSeconds: loaded.durationSeconds, wantStartSeconds: 5 });
    const info = await probeTrimmed(await trimVideo(loaded, range), "out-rotated.mp4");

    expect(info.stderr).toMatch(/rotation of 90/);
  }, 60000);

  it("最後まで崩れずに再生できる", async () => {
    const loaded = await loadVideoForTrim(plain);
    const range = planTrim({ keyframeTimes: loaded.keyframeTimes, durationSeconds: loaded.durationSeconds, wantStartSeconds: 9 });
    const output = await trimVideo(loaded, range);
    const path = join(workDir, "out-decode.mp4");
    await writeFile(path, Buffer.from(await output.arrayBuffer()));

    // 全コマを解いて、文句（error）が出ないことを見る
    const ffmpeg = await ffmpegPath();
    const { stderr } = await execFileAsync(ffmpeg, ["-hide_banner", "-v", "error", "-i", path, "-f", "null", "-"], { maxBuffer: 8 * 1024 * 1024 });
    expect(stderr.trim()).toBe("");
  }, 60000);

  it("映像と音の出だしがそろう ── 同じ時刻を 0 秒とする", async () => {
    const loaded = await loadVideoForTrim(plain);
    // キーフレームでない位置を起点にしても（切り取りの画面では起きない）ずれないこと
    const output = await trimVideo(loaded, { startSeconds: 15, endSeconds: 45 });

    const { createFile, MP4BoxBuffer } = await import("mp4box");
    const parsed = createFile();
    let movie: { videoTracks: { id: number }[]; audioTracks: { id: number }[] } | undefined;
    parsed.onReady = (info) => {
      movie = info;
    };
    parsed.appendBuffer(MP4BoxBuffer.fromArrayBuffer(await output.arrayBuffer(), 0));
    parsed.flush();
    expect(movie).toBeDefined();

    const firstTime = (trackId: number) => {
      const samples = parsed.getTrackSamplesInfo(trackId);
      return samples[0].cts / samples[0].timescale;
    };
    // 音は起点より前から写せないので 1 コマ（AAC で 20〜50 ミリ秒）までは遅れる
    const gap = Math.abs(firstTime(movie!.audioTracks[0].id) - firstTime(movie!.videoTracks[0].id));
    expect(gap).toBeLessThan(0.1);
  }, 60000);

  it("「やめる」を押したら途中で止まる", async () => {
    const loaded = await loadVideoForTrim(plain);
    const range = planTrim({ keyframeTimes: loaded.keyframeTimes, durationSeconds: loaded.durationSeconds, wantStartSeconds: 0 });
    await expect(trimVideo(loaded, range, { isCancelled: () => true })).rejects.toMatchObject({ code: "cancelled" });
  }, 60000);

  it("進み具合を伝え、最後は 1 になる", async () => {
    const loaded = await loadVideoForTrim(plain);
    const range = planTrim({ keyframeTimes: loaded.keyframeTimes, durationSeconds: loaded.durationSeconds, wantStartSeconds: 0 });
    const seen: number[] = [];
    await trimVideo(loaded, range, { onProgress: (ratio) => seen.push(ratio) });
    expect(seen.length).toBeGreaterThan(1);
    expect(seen.at(-1)).toBe(1);
    // 後戻りしない
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  }, 60000);
});
