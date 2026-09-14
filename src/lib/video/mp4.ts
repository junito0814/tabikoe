/**
 * F-PO-01 動画対応 Task2: MP4 の実体検証と ffmpeg 出力の解釈（純粋関数）
 * 出典: docs/tasks/posts/video-upload/02-video-processing-handler.md
 *       要件定義書5.4「Route Handlers側でファイルの実体を検証する」
 *
 * 子プロセスやファイルI/Oを含まない部分をここに分け、単体テストの対象にする。
 */

/** ISO BMFF（MP4/MOV）のファイル先頭は [size(4)][ "ftyp"(4) ][major_brand(4)] で始まる */
const FTYP = "ftyp";

/** MP4 として受け付ける major/compatible brand。MOV（qt）や 3GP は対象外（要件: MP4のみ） */
const MP4_BRANDS = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "dash"]);

/**
 * 先頭バイト列が MP4 かどうか。拡張子や Content-Type は信用せず、ftyp ボックスで判定する。
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
    if (MP4_BRANDS.has(ascii(offset, 4))) return true;
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
