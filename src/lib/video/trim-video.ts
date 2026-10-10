"use client";

import type { ISOFile, Movie, Sample, Track } from "mp4box";
import { type TrimRange } from "@/lib/video/trim-plan";

/**
 * #861 / 要件定義書 4.5.17（2026-10-10）: 動画を**作り直さずに**切り取る。
 *
 * 【初心者向け】「作り直さない」とはどういうことか。
 *   MP4 は「コマの並び（映像・音のかたまり）」と「目次」が入った**入れ物**です。
 *   切り取りは、必要なかたまりだけを**そのまま写して、目次を作り直す**作業です。
 *   コマを作り直さない（再エンコードしない）ので、**画質はまったく落ちず**、速いです。
 *   ブラウザに標準の口が無いので、`mp4box.js`（MP4 の読み書きをする部品）を使います。
 *
 * **測って確かめたこと**（2026-10-10、手元の macOS ＋ ffmpeg で検証）:
 *   40 秒・720×1280・H.264 ＋ AAC の動画を 10.07 秒から 30 秒ぶん切り取って
 *   → 長さ 29.97 秒・h264・aac 44100Hz・回転の情報も保たれ、全コマを問題なく再生できた。
 *   回転の情報（`matrix`）は**自分で写さないと失われます**（iPhone の縦撮りが横になります）。
 *   `mp4box.js` の `addTrack` は回転なしで作るので、作ったあとに写しています。
 */

/** 読み込みが終わるまでの待ち時間。これを超えたら「この端末では切り取れない」として扱う */
export const TRIM_PARSE_TIMEOUT_MS = 20000;

export class TrimError extends Error {
  constructor(readonly code: "unsupported" | "no_video_track" | "no_keyframes" | "cancelled" | "failed") {
    super(code);
    this.name = "TrimError";
  }
}

/**
 * その端末で切り取りを**試みてよいか**の第一関門（`decideMedia` の `canTrim`）。
 *
 * 【初心者向け】これは「できる」の保証ではありません。
 *   本当に動くかは試すまで分からないので、**できあがりを測る安全網**
 *   （`checkTrimmedOutput`）が本番の関門です。ここは、古いブラウザのように
 *   **明らかに足りないもの**を先に弾くだけです。
 */
export function canTrimVideo(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof File === "function" &&
    typeof Blob === "function" &&
    typeof File.prototype.arrayBuffer === "function" &&
    typeof TextDecoder === "function" &&
    typeof BigInt === "function" &&
    typeof URL.createObjectURL === "function"
  );
}

export interface LoadedVideo {
  /** 全体の長さ（秒） */
  durationSeconds: number;
  /** キーフレームの時刻（秒）。ここからしか切り出せない */
  keyframeTimes: number[];
  width: number;
  height: number;
  /** 切り取るときに使う内部状態 */
  readonly source: TrimSource;
}

interface TrimSource {
  /** 元のファイル。切り取るときに**要る範囲だけ**を読み直す */
  source: File;
  file: ISOFile;
  info: Movie;
  video: Track;
  audio: Track | undefined;
}

/** 目次を探すときに 1 回で読む大きさ */
export const INDEX_CHUNK_BYTES = 1024 * 1024;

/** mp4box は 300KB ほどあるので、切り取りの画面に来てから読み込む */
async function loadMp4Box() {
  try {
    return await import("mp4box");
  } catch {
    throw new TrimError("unsupported");
  }
}

/**
 * 動画を読み、長さとキーフレームの位置を調べる。
 *
 * 【初心者向け】**ファイル全部は読みません。** 要るのは「目次」（`moov`）だけで、
 *   映像の中身（`mdat`）は切り取るときまで要りません。
 *
 *   困るのは、**目次がどこにあるか決まっていない**ことです。iPhone のカメラは
 *   **末尾**に置きます（撮り終わるまで中身の大きさが分からないため）。
 *   そこで mp4box に少しずつ渡します。`appendBuffer` は「**次はどこを読めばよいか**」を
 *   返すので、そこへ飛んで読み直します。中身はまたがずに済みます。
 *
 * **測った差**（26.2MB・120 秒・目次は末尾、2026-10-10）:
 *   全部読む **26.2MB** → 必要なところだけ **1.1MB（2 回）**。**読む量が 4%**。
 *   実機の動画は数百 MB になるので、ここが待ち時間のほとんどでした（#923）。
 */
async function readIndex(
  file: File,
  createFile: (typeof import("mp4box"))["createFile"],
  MP4BoxBuffer: (typeof import("mp4box"))["MP4BoxBuffer"],
  onProgress?: (ratio: number) => void
): Promise<{ isoFile: ISOFile; movie: Movie }> {
  const ready: { movie?: Movie } = {};
  const isoFile = createFile();
  isoFile.onReady = (movie) => {
    ready.movie = movie;
  };

  let next = 0;
  let readBytes = 0;
  while (ready.movie === undefined && next < file.size) {
    const end = Math.min(next + INDEX_CHUNK_BYTES, file.size);
    const part = await file.slice(next, end).arrayBuffer();
    readBytes += end - next;
    const nextPosition = isoFile.appendBuffer(MP4BoxBuffer.fromArrayBuffer(part, next));
    /*
     * `appendBuffer` が「次はここ」と返す。進まないときは、
     * まだ足りないだけなので続きを読む（無限に回らないよう必ず前へ出す）。
     */
    next = nextPosition > next ? nextPosition : end;
    onProgress?.(Math.min(0.99, readBytes / Math.max(file.size, 1)));
  }
  isoFile.flush();

  const movie = ready.movie;
  if (movie === undefined) throw new TrimError("unsupported");
  return { isoFile, movie };
}

export async function loadVideoForTrim(file: File, options: { onProgress?: (ratio: number) => void } = {}): Promise<LoadedVideo> {
  const { createFile, MP4BoxBuffer } = await loadMp4Box();

  let isoFile: ISOFile;
  let movie: Movie;
  try {
    ({ isoFile, movie } = await readIndex(file, createFile, MP4BoxBuffer, options.onProgress));
  } catch (error) {
    if (error instanceof TrimError && error.code !== "unsupported") throw error;
    /*
     * 少しずつ読む方法で目次が見つからなかったときの保険。
     * **今までどおり全部読んで**やり直す（#923 で速くしたが、確実さは落とさない）。
     */
    const ready: { movie?: Movie } = {};
    try {
      isoFile = createFile();
      isoFile.onReady = (parsed) => {
        ready.movie = parsed;
      };
      isoFile.appendBuffer(MP4BoxBuffer.fromArrayBuffer(await file.arrayBuffer(), 0));
      isoFile.flush();
    } catch {
      throw new TrimError("unsupported");
    }
    if (ready.movie === undefined) throw new TrimError("unsupported");
    movie = ready.movie;
  }
  options.onProgress?.(1);

  const video = movie.videoTracks[0];
  if (!video) throw new TrimError("no_video_track");

  const samples = isoFile.getTrackSamplesInfo(video.id);
  const keyframeTimes = samples.filter((sample) => sample.is_sync).map((sample) => sample.cts / sample.timescale);
  /*
   * キーフレームが 1 つも無い動画は切り取れない。
   * （全コマがキーフレームの動画は `is_sync` が立っていないことがあるため、
   *  「0 個」のときだけ断り、1 個でもあれば先頭からは切れるものとして扱う）
   */
  if (keyframeTimes.length === 0) throw new TrimError("no_keyframes");

  return {
    durationSeconds: movie.duration / movie.timescale,
    keyframeTimes,
    width: video.track_width,
    height: video.track_height,
    source: { source: file, file: isoFile, info: movie, video, audio: movie.audioTracks[0] },
  };
}

/**
 * 読み込んだバイトの範囲。
 *
 * 【初心者向け】ファイル全部ではなく、**切り取るコマが入っている範囲だけ**を読みます。
 * `at()` はファイル全体での位置を渡すと、読み込んだ範囲の中の該当部分を返します。
 */
interface LoadedBytes {
  start: number;
  buffer: ArrayBuffer;
  at(offset: number, size: number): Uint8Array<ArrayBuffer>;
}

function loadedBytes(start: number, buffer: ArrayBuffer): LoadedBytes {
  return {
    start,
    buffer,
    at(offset, size) {
      return new Uint8Array(buffer, offset - start, size);
    },
  };
}

/**
 * どこまで写すか（この番号の手前まで）。
 *
 * **30 秒の線をまたぐコマは入れない。** 入れると長さが 30 秒を超え、サーバーに
 * `video_too_long` で断られる（実際に 30.4 秒になって気づいた）。
 * 見るのは**再生の時刻（cts）**で、記録の時刻ではない ── 動画の長さは
 * 「いちばん後ろに映るコマの終わり」で決まるため。
 */
function endIndexWithin(
  samples: readonly Sample[],
  firstIndex: number,
  span: { subtractSeconds: number; ctsShiftSeconds: number; windowSeconds: number },
  timescale: number
): number {
  const base = span.subtractSeconds * timescale;
  const ctsShift = span.ctsShiftSeconds * timescale;
  for (let i = firstIndex; i < samples.length; i++) {
    const sample = samples[i];
    if ((sample.cts - base + ctsShift + sample.duration) / sample.timescale > span.windowSeconds + 0.0001) return i;
  }
  return samples.length;
}

/** 写すコマが入っているバイトの範囲を数える（ここだけ読めばよい） */
function byteRangeOf(samples: readonly { offset: number; size: number }[], from: number, to: number): { start: number; end: number } {
  let start = Infinity;
  let end = 0;
  for (let i = from; i < to && i < samples.length; i++) {
    start = Math.min(start, samples[i].offset);
    end = Math.max(end, samples[i].offset + samples[i].size);
  }
  return { start: start === Infinity ? 0 : start, end };
}

/** 新しい入れ物に写すとき、サンプル記述（avcC / esds など）をそのまま持っていく */
function descriptionBoxes(isoFile: ISOFile, trackId: number): { type: string; boxes: unknown[] } {
  const trak = isoFile.getTrackById(trackId);
  const entry = trak.mdia.minf.stbl.stsd.entries[0] as unknown as Record<string, unknown> & { type: string };
  // 映像なら avcC（H.264）、音なら esds（AAC）。無い形式もあるので、あるものだけ写す
  const boxes = ["avcC", "hvcC", "av1C", "vpcC", "esds", "dOps", "dfLa", "btrt", "pasp", "colr"]
    .map((name) => entry[name])
    .filter((box) => box !== undefined && box !== null);
  return { type: entry.type, boxes };
}

/**
 * 切り出しの起点になるコマ（キーフレーム）を探す。
 *
 * 時刻ではなく**並び順の位置**を返すのが大事。時刻だけで選ぶと、
 * B フレーム（前後のコマを参照するコマ）が参照先を失って崩れます
 * ── コマは**記録された順と再生する順が違う**ことがあるためです。
 */
function findKeyframeIndex(samples: readonly Sample[], startSeconds: number): number {
  let found = -1;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (!sample.is_sync) continue;
    if (sample.cts / sample.timescale <= startSeconds + 0.001) found = i;
    else break;
  }
  return found < 0 ? 0 : found;
}

/**
 * 1 本の軌道（映像または音）から、範囲に入るコマを写す。
 *
 * 【初心者向け】`baseSeconds` を**映像と音で共通にする**のが要です。
 *   軌道ごとに「その軌道の最初のコマ」を 0 秒とすると、映像はキーフレームの位置、
 *   音はその少しあとが 0 秒になり、**音がずれます**（最大でキーフレームの間隔ぶん、2 秒ほど）。
 *   同じ時刻を 0 秒と決めて、それぞれの刻み（timescale）に直して引きます。
 *
 * もうひとつの要は、**30 秒の線をまたぐコマを入れない**こと。入れると長さが 30 秒を超え、
 * サーバーに `video_too_long` で断られます（実際に 30.4 秒になって気づきました）。
 *
 * 見るのは**再生の時刻（cts）**で、記録の時刻（dts）ではありません。
 * 動画の長さは「いちばん後ろに映るコマの終わり」で決まるからです。
 * B フレームがあると cts は記録順に並ばないので、最初に線を越えたところで止めます
 * ── コマ 1〜2 枚ぶん短くなるだけで、**30 秒を超えないことは必ず守られます**。
 */
function copySamples(
  isoFile: ISOFile,
  output: ISOFile,
  bytes: LoadedBytes,
  track: Track,
  outputTrackId: number,
  span: { subtractSeconds: number; ctsShiftSeconds: number; firstIndex: number; endIndex: number },
  options: { onSample?: () => void; isCancelled?: () => boolean }
): number {
  const samples = isoFile.getTrackSamplesInfo(track.id);
  // 起点とずらし量を、この軌道の刻みに直す
  const base = span.subtractSeconds * track.timescale;
  const ctsShift = span.ctsShiftSeconds * track.timescale;
  let copied = 0;
  for (let i = span.firstIndex; i < span.endIndex; i++) {
    if (options.isCancelled?.()) throw new TrimError("cancelled");
    const sample: Sample = samples[i];
    output.addSample(outputTrackId, bytes.at(sample.offset, sample.size), {
      duration: sample.duration,
      cts: Math.round(sample.cts - base + ctsShift),
      dts: Math.round(sample.dts - base),
      is_sync: sample.is_sync,
      is_leading: sample.is_leading,
      depends_on: sample.depends_on,
      is_depended_on: sample.is_depended_on,
      has_redundancy: sample.has_redundancy,
    });
    copied++;
    options.onSample?.();
  }
  return copied;
}

/**
 * 範囲を切り取って、新しい動画のファイルを作る。
 *
 * @param onProgress 0〜1。帯の進み具合に使う
 * @param isCancelled 「やめる」を押したか。押されたら `TrimError("cancelled")` を投げる
 */
export async function trimVideo(
  loaded: LoadedVideo,
  range: TrimRange,
  options: { onProgress?: (ratio: number) => void; isCancelled?: () => boolean } = {}
): Promise<File> {
  const { createFile } = await loadMp4Box();
  const { source: sourceFile, file: isoFile, video, audio } = loaded.source;

  let output: ISOFile;
  let videoTrackId: number | undefined;
  let audioTrackId: number | undefined;
  try {
    output = createFile();
    const videoDescription = descriptionBoxes(isoFile, video.id);
    videoTrackId = output.addTrack({
      timescale: video.timescale,
      width: video.track_width,
      height: video.track_height,
      type: videoDescription.type as never,
      language: video.language,
      hdlr: "vide",
      name: "VideoHandler",
      description_boxes: videoDescription.boxes as never,
    });
    if (videoTrackId === undefined) throw new TrimError("failed");
    /*
     * 回転の情報を写す。**これを忘れると iPhone の縦撮りが横向きになります。**
     * `addTrack` は回転なし（単位行列）で作るので、作ったあとに上書きします。
     */
    output.getTrackById(videoTrackId).tkhd.matrix = video.matrix;

    if (audio) {
      const audioDescription = descriptionBoxes(isoFile, audio.id);
      audioTrackId = output.addTrack({
        timescale: audio.timescale,
        type: audioDescription.type as never,
        hdlr: "soun",
        name: "SoundHandler",
        language: audio.language,
        channel_count: audio.audio?.channel_count ?? 2,
        samplesize: audio.audio?.sample_size ?? 16,
        samplerate: audio.audio?.sample_rate ?? 44100,
        description_boxes: audioDescription.boxes as never,
      });
    }
  } catch (error) {
    if (error instanceof TrimError) throw error;
    throw new TrimError("failed");
  }

  /*
   * 進み具合。写すコマの数はあらかじめ分からないので、
   * 「範囲の長さ ÷ 全体の長さ × コマ数」でおおよその総数を見積もる。
   */
  const expectedSamples = Math.max(
    1,
    Math.round((video.nb_samples * (range.endSeconds - range.startSeconds)) / Math.max(loaded.durationSeconds, 0.001)) + (audio ? Math.round((audio.nb_samples * (range.endSeconds - range.startSeconds)) / Math.max(loaded.durationSeconds, 0.001)) : 0)
  );
  let done = 0;
  const onSample = () => {
    done++;
    if (done % 32 === 0) options.onProgress?.(Math.min(0.99, done / expectedSamples));
  };

  try {
    /*
     * 起点をひとつ決める。`planTrim` はキーフレームの時刻を返すが、
     * 念のため**実際のコマの時刻**から取り直す（寄せ先と 1 コマずれていても合わせる）。
     */
    const videoSamples = isoFile.getTrackSamplesInfo(video.id);
    const firstVideoIndex = findKeyframeIndex(videoSamples, range.startSeconds);
    const firstVideoSample = videoSamples[firstVideoIndex];
    const baseSeconds = firstVideoSample.dts / firstVideoSample.timescale;
    /*
     * 映像の「先回り」の秒数（`cts - dts`）。
     *
     * 【初心者向け】なぜこれを数えるのか。
     *   B フレームを使う動画は、**記録する順と映す順が違います**。順番を入れ替える都合で、
     *   映す時刻（cts）が記録の時刻（dts）より少し先になります。元のファイルには
     *   「そのぶん頭を飛ばして再生せよ」という指示（編集リスト）が入っていて、見た目は 0 秒から始まります。
     *   `mp4box.js` には編集リストを書く口がないので、**音を同じだけ後ろへずらして**つじつまを合わせます。
     *   ずらさないと、音だけ先に出ます（手元の例では 0.2 秒。口の動きとのずれが分かる差です）。
     *   iPhone のカメラのように B フレームを使わない動画では 0 になり、何も起きません。
     */
    const ctsLeadSeconds = (firstVideoSample.cts - firstVideoSample.dts) / firstVideoSample.timescale;

    /*
     * #928: 写す長さは**選ばれた範囲**から取る（30 秒固定をやめた）。
     *
     * 【初心者向け】なぜ `range.endSeconds - range.startSeconds` ではないのか。
     *   実際の起点は `baseSeconds`（本当のキーフレームの時刻）で、選ばれた `startSeconds` と
     *   1 コマずれていることがあります。**終わりの時刻を合わせたい**ので、
     *   起点からの長さに直します。
     */
    const windowSeconds = Math.max(0, range.endSeconds - baseSeconds);
    const videoSpan = { subtractSeconds: baseSeconds, ctsShiftSeconds: 0, windowSeconds };
    const videoEnd = endIndexWithin(videoSamples, firstVideoIndex, videoSpan, video.timescale);

    /*
     * 音は**起点以降の最初のコマ**から写す（起点より前から写すと時刻が負になる）。
     * 起点をまたぐコマを飛ばすぶん、音の出だしが 1 コマ（AAC なら 20〜50 ミリ秒）遅れるが、
     * これは耳では分からない差。
     *
     * 映す時刻だけ `ctsLeadSeconds` ぶん後ろへずらす ── こうすると音も映像と同じだけ
     * 後ろにずれ、両者の関係が元のまま保たれる。
     *
     * 【初心者向け】なぜ「引く量」ではなく「映す時刻」をずらすのか。
     *   MP4 の目次は**各コマの長さ**を並べたもので、最初のコマは必ず 0 からになります。
     *   「この軌道は 0.2 秒あとから始まる」は目次には書けず、`mp4box.js` が書ける形では
     *   **映す時刻のずれ（cts − dts）**だけが残ります。そこへ入れます。
     */
    const audioSpan = { subtractSeconds: baseSeconds, ctsShiftSeconds: ctsLeadSeconds, windowSeconds };
    const audioSamples = audio ? isoFile.getTrackSamplesInfo(audio.id) : [];
    const firstAudioIndex = audio ? audioSamples.findIndex((sample) => sample.dts / sample.timescale >= baseSeconds - 0.0001) : -1;
    const audioEnd = firstAudioIndex >= 0 ? endIndexWithin(audioSamples, firstAudioIndex, audioSpan, audio!.timescale) : 0;

    /*
     * ここで初めてファイルを読む ── **写すコマが入っている範囲だけ**。
     *
     * 【初心者向け】いままでは全部読んでいました（#923）。写すのはひと続きの範囲なので、
     * その範囲だけ読めば足ります。測ったところ 26.2MB の動画で **6.5MB**（25%）でした。
     */
    const videoRange = byteRangeOf(videoSamples, firstVideoIndex, videoEnd);
    const audioRange = firstAudioIndex >= 0 ? byteRangeOf(audioSamples, firstAudioIndex, audioEnd) : { start: Infinity, end: 0 };
    const start = Math.min(videoRange.start, audioRange.start);
    const end = Math.max(videoRange.end, audioRange.end);
    if (!(end > start)) throw new TrimError("failed");
    const bytes = loadedBytes(start, await sourceFile.slice(start, end).arrayBuffer());

    const copiedVideo = copySamples(isoFile, output, bytes, video, videoTrackId, { ...videoSpan, firstIndex: firstVideoIndex, endIndex: videoEnd }, { onSample, isCancelled: options.isCancelled });
    if (copiedVideo === 0) throw new TrimError("failed");

    if (audio && audioTrackId !== undefined && firstAudioIndex >= 0) {
      copySamples(isoFile, output, bytes, audio, audioTrackId, { ...audioSpan, firstIndex: firstAudioIndex, endIndex: audioEnd }, { onSample, isCancelled: options.isCancelled });
    }
    options.onProgress?.(1);

    const stream = output.getBuffer();
    const written = (stream as unknown as { buffer?: ArrayBuffer }).buffer ?? (stream as unknown as ArrayBuffer);
    return new File([written], "trimmed.mp4", { type: "video/mp4" });
  } catch (error) {
    if (error instanceof TrimError) throw error;
    throw new TrimError("failed");
  }
}
