import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";
import { checkVideo, parseVideoInfo } from "./process-video";
import { checkTrimmedOutput, moveEnd, planTrim, trimLengthSeconds, TRIM_WINDOW_SECONDS } from "./trim-plan";
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
/**
 * 読む量を数えるための、少し大きい素材（数 MB）。
 *
 * 【初心者向け】`plain` は 191KB しかなく、**1 回の読み込みに収まってしまう**ので
 * 「全部は読まない」を見張れません（実際そう書いて赤くなりました）。
 * 1MB ずつ読む作りなので、それより十分大きいものが要ります。
 */
let heavy: File;

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
  const toFile = async (path: string, name: string) => {
    const bytes = await readFile(path);
    return new File([new Uint8Array(bytes)], name, { type: "video/mp4" });
  };
  plain = await toFile(plainPath, "plain.mp4");
  await writeFile(rotatedPath, await rotateNinetyDegrees(await readFile(plainPath)));
  rotated = await toFile(rotatedPath, "rotated.mp4");

  // 40 秒・640×480・高めのビットレート。目次は末尾（`+faststart` を付けない＝ iPhone と同じ）
  const heavyPath = join(workDir, "heavy.mp4");
  await execFileAsync(ffmpeg, [
    "-hide_banner", "-y",
    "-f", "lavfi", "-i", "testsrc=size=640x480:rate=30:duration=40",
    "-c:v", "libx264", "-preset", "ultrafast", "-b:v", "3M", "-g", "60", "-pix_fmt", "yuv420p",
    "-an", "-t", "40", heavyPath,
  ]);
  heavy = await toFile(heavyPath, "heavy.mp4");
}

/**
 * 「90 度回した」動画を作る（iPhone の縦撮りに相当）。
 *
 * 【初心者向け】ffmpeg に回転を書かせない理由。
 *   `-metadata rotate=90` は版によって扱いが変わり、**作ったつもりで回っていない**ことがあります
 *   （素材が回っていなければ、この見張りは何も見張れません）。
 *   回転は `tkhd` という箱の中の **36 バイトの行列**なので、そこを直に書き換えます。
 *   箱の場所は mp4box に教えてもらうので、当て推量ではありません。
 */
async function rotateNinetyDegrees(bytes: Buffer): Promise<Buffer> {
  const { createFile, MP4BoxBuffer } = await import("mp4box");
  const file = createFile();
  let movie: { videoTracks: { id: number }[] } | undefined;
  file.onReady = (info) => {
    movie = info;
  };
  const copy = Buffer.from(bytes);
  file.appendBuffer(MP4BoxBuffer.fromArrayBuffer(copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength), 0));
  file.flush();
  if (!movie) throw new Error("素材を読めなかった");
  const tkhd = file.getTrackById(movie.videoTracks[0].id).tkhd;
  if (tkhd.start === undefined) throw new Error("tkhd の位置が分からなかった");
  /*
   * tkhd の並び: 大きさ 4 ＋ 種類 4 ＋ 版と旗 4 ＋ 作成 ＋ 更新 ＋ 軌道 ID 4 ＋ 予備 4 ＋ 長さ
   *   ＋ 予備 8 ＋ 層 2 ＋ 組 2 ＋ 音量 2 ＋ 予備 2 → ここから行列 36 バイト。
   * 「作成・更新・長さ」は**版 1 だと 8 バイトずつ**になるので、版を読んでから数える。
   */
  const version = copy.readUInt8(tkhd.start + 8);
  const matrixAt = tkhd.start + (version === 1 ? 60 : 48);
  const rotate90 = [0, 65536, 0, -65536, 0, 0, 0, 0, 1073741824];
  for (let i = 0; i < rotate90.length; i++) copy.writeInt32BE(rotate90[i], matrixAt + i * 4);
  return copy;
}

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "tabikoe-trim-test-"));
  await encodeFixtures();
}, 120000);

/** 出来上がりの映像の回転（tkhd の matrix）を mp4box で読む */
async function readTrackMatrix(output: File) {
  const { createFile, MP4BoxBuffer } = await import("mp4box");
  const parsed = createFile();
  let movie: { videoTracks: { matrix: ArrayLike<number> }[] } | undefined;
  parsed.onReady = (info) => {
    movie = info;
  };
  parsed.appendBuffer(MP4BoxBuffer.fromArrayBuffer(await output.arrayBuffer(), 0));
  parsed.flush();
  if (!movie) throw new Error("出来上がりを読めなかった");
  return movie.videoTracks[0].matrix;
}

/** 切り取った結果をファイルに落として ffmpeg に読ませる */
async function probeTrimmed(output: File, name: string) {
  const path = join(workDir, name);
  await writeFile(path, Buffer.from(await output.arrayBuffer()));
  return probe(path);
}

/**
 * 読んだバイト数を数える File。
 * `slice()` と `arrayBuffer()` を包んで、**どれだけ読んだか**を記録する。
 */
function countingFile(file: File) {
  const counter = { read: 0 };
  const wrap = (inner: Blob): Blob =>
    ({
      size: inner.size,
      slice: (start?: number, end?: number) => wrap(inner.slice(start, end)),
      arrayBuffer: async () => {
        counter.read += inner.size;
        return inner.arrayBuffer();
      },
    }) as unknown as Blob;
  const counted = wrap(file) as File;
  Object.defineProperty(counted, "name", { value: file.name });
  Object.defineProperty(counted, "type", { value: file.type });
  return { file: counted, counter };
}

describe("読む量（#923）", () => {
  it("目次を読むのに、ファイル全部を読まない", async () => {
    const { file, counter } = countingFile(heavy);
    const loaded = await loadVideoForTrim(file);

    expect(loaded.durationSeconds).toBeCloseTo(40, 1);
    /*
     * 目次（moov）はファイルの末尾にある（iPhone のカメラと同じ）。
     * mp4box が「次はどこ」と教えてくれるので、頭と末尾だけ読めば足りる。
     */
    expect(counter.read).toBeLessThan(heavy.size * 0.5);
  }, 60000);

  it("切り取るとき、写すところだけ読む", async () => {
    const loaded = await loadVideoForTrim(heavy);
    const { file, counter } = countingFile(heavy);
    // 読み込み済みの目次はそのままに、読み直す先だけ数える File に差し替える
    (loaded.source as { source: File }).source = file;

    const range = planTrim({ keyframeTimes: loaded.keyframeTimes, durationSeconds: loaded.durationSeconds, wantStartSeconds: 5 });
    await trimVideo(loaded, range);

    // 40 秒のうち 30 秒ぶん。全部読んでいたら 100% になる
    expect(counter.read).toBeGreaterThan(0);
    expect(counter.read).toBeLessThan(heavy.size * 0.95);
  }, 60000);

  it("読み込みの進み具合を伝える", async () => {
    const seen: number[] = [];
    await loadVideoForTrim(plain, { onProgress: (ratio) => seen.push(ratio) });
    expect(seen.at(-1)).toBe(1);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  }, 60000);
});

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

  /**
   * #928（2026-10-11）: 長さを自分で決められるようにしたので、**選んだ長さで出来る**ことを
   * 本物の MP4 で確かめる（受入条件）。ここが通らないと、画面で 5 秒を選んでも 30 秒出来てしまう。
   */
  it("選んだ長さで切れる（30 秒固定ではない）", async () => {
    const loaded = await loadVideoForTrim(plain);
    const start = planTrim({ keyframeTimes: loaded.keyframeTimes, durationSeconds: loaded.durationSeconds, wantStartSeconds: 6 });
    // 6 秒から 5 秒だけ（終わりのつまみを引き寄せた状態）
    const range = moveEnd({ durationSeconds: loaded.durationSeconds, current: start, wantEndSeconds: start.startSeconds + 5 });
    expect(trimLengthSeconds(range)).toBeCloseTo(5, 5);

    const info = await probeTrimmed(await trimVideo(loaded, range), "out-5s.mp4");
    expect(info.durationSeconds).not.toBeNull();
    // 1 コマぶんの誤差は許す（最後のコマが線をまたぐときは入れない）
    expect(info.durationSeconds!).toBeGreaterThan(4.5);
    expect(info.durationSeconds!).toBeLessThan(5.3);
    // 出来上がりの検査（画面が使っているもの）も通る
    expect(checkTrimmedOutput({ durationSeconds: info.durationSeconds, sizeBytes: 1000, expectedSeconds: 5 }).ok).toBe(true);
    expect(checkVideo(info)).toEqual({ ok: true, durationSeconds: info.durationSeconds });
  }, 60000);

  /** 下限（1 秒）でも壊れないこと ── つまみを一番狭くしたときに作られるもの */
  it("1 秒でも再生できるものが出来る", async () => {
    const loaded = await loadVideoForTrim(plain);
    const start = planTrim({ keyframeTimes: loaded.keyframeTimes, durationSeconds: loaded.durationSeconds, wantStartSeconds: 10 });
    const range = moveEnd({ durationSeconds: loaded.durationSeconds, current: start, wantEndSeconds: start.startSeconds + 1 });
    const info = await probeTrimmed(await trimVideo(loaded, range), "out-1s.mp4");
    expect(info.durationSeconds).not.toBeNull();
    expect(info.durationSeconds!).toBeGreaterThan(0.5);
    expect(info.durationSeconds!).toBeLessThan(1.3);
    expect(info.videoCodec).toBe("h264");
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
    /*
     * 【初心者向け】なぜ ffmpeg の文字ではなく、箱の中身を直接見るのか。
     *   はじめは `ffmpeg -i` が出す「rotation of 90 degrees」を読んでいましたが、
     *   **ffmpeg の版で出力が変わり、CI（7.0）だけ赤くなりました**。
     *   確かめたいのは「元の回転が出来上がりに写っているか」なので、
     *   mp4box で**両方の行列（matrix）を読んで比べます**。版に左右されません。
     */
    const loaded = await loadVideoForTrim(rotated);
    const sourceMatrix = Array.from(loaded.source.video.matrix);
    // 90 度回転は単位行列ではない（素材が本当に回っていることの確認）
    expect(sourceMatrix).not.toEqual([65536, 0, 0, 0, 65536, 0, 0, 0, 1073741824]);

    const range = planTrim({ keyframeTimes: loaded.keyframeTimes, durationSeconds: loaded.durationSeconds, wantStartSeconds: 5 });
    const output = await trimVideo(loaded, range);
    expect(Array.from(await readTrackMatrix(output))).toEqual(sourceMatrix);
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
