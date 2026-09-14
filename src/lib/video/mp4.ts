/**
 * F-PO-01 動画対応 Task2: MP4 の実体検証と ffmpeg 出力の解釈（純粋関数）
 * 出典: docs/tasks/posts/video-upload/02-video-processing-handler.md
 *       要件定義書5.4「Route Handlers側でファイルの実体を検証する」
 *
 * 子プロセスやファイルI/Oを含まない部分をここに分け、単体テストの対象にする。
 */

/** ISO BMFF（MP4/MOV）のファイル先頭は [size(4)][ "ftyp"(4) ][major_brand(4)] で始まる */
const FTYP = "ftyp";

/**
 * 受け付ける major/compatible brand。MP4 系に加え、iPhone 標準カメラの MOV（QuickTime, "qt  "）も
 * 受け付ける（v2.9）。MOV は同じ ISO BMFF 系のため、ffmpeg で MP4 へ変換できる。3GP 等は対象外。
 */
const ACCEPTED_BRANDS = new Set([
  "isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "dash",
  "qt  ",
]);

/**
 * 先頭バイト列が MP4／MOV かどうか。拡張子や Content-Type は信用せず、ftyp ボックスで判定する。
 * @param head ファイル先頭（最低 32 バイトあれば十分）
 */
export function isMp4Header(head: Uint8Array): boolean {
  if (head.byteLength < 12) return false;
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...head.subarray(offset, offset + length));

  if (ascii(4, 4) !== FTYP) return false;

  // ftyp ボックスのサイズ分だけ brand を走査する（major_brand + compatible_brands）
  const boxSize = ((head[0] << 24) | (head[1] << 16) | (head[2] << 8) | head[3]) >>> 0;
  const end = Math.min(head.byteLength, boxSize > 0 ? boxSize : head.byteLength);
  for (let offset = 8; offset + 4 <= end; offset += 4) {
    if (offset === 12) continue; // minor_version
    if (ACCEPTED_BRANDS.has(ascii(offset, 4))) return true;
  }
  return false;
}

/**
 * `ffmpeg -i input` が標準エラーに出す "Duration: HH:MM:SS.ss" を秒に変換する。
 * 見つからなければ null（壊れたファイル・音声のみ等は呼び出し側で拒否する）。
 */
export function parseFfmpegDuration(stderr: string): number | null {
  const match = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(stderr);
  if (!match) return null;
  const [, hours, minutes, seconds] = match;
  const total = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  return Number.isFinite(total) ? total : null;
}

/** `ffmpeg -i input` の出力に映像ストリームが含まれるか（音声のみのMP4を弾く） */
export function hasVideoStream(stderr: string): boolean {
  return /Stream #\d+:\d+.*:\s*Video:/.test(stderr);
}

/**
 * `ffmpeg -i input` の出力から映像・音声のコーデック名を読む。
 * iPhone の HEVC（H.265）は Chrome 等で再生できないため、H.264 へ再エンコードする判断に使う。
 */
export function parseStreamCodecs(stderr: string): { video: string | null; audio: string | null } {
  const video = /Stream #\d+:\d+.*:\s*Video:\s*([a-z0-9_]+)/i.exec(stderr)?.[1]?.toLowerCase() ?? null;
  const audio = /Stream #\d+:\d+.*:\s*Audio:\s*([a-z0-9_]+)/i.exec(stderr)?.[1]?.toLowerCase() ?? null;
  return { video, audio };
}

/** ブラウザ横断で再生できる組み合わせ（H.264 + AAC）ならコンテナ変換だけで済む */
export function needsVideoReencode(codec: string | null): boolean {
  return codec !== "h264";
}

export function needsAudioReencode(codec: string | null): boolean {
  return codec !== null && codec !== "aac";
}
