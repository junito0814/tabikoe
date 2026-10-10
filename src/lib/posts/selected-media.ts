import type { MediaItem } from "@/components/media/MediaGrid";
import type { SelectedMedia } from "@/components/media/SelectedMediaThumbnails";
import { formatSeconds } from "@/lib/posts/accept-media";

/**
 * #927 / 要件定義書 4.5.1・ワイヤーフレーム決定事項 90（2026-10-11）:
 * 投稿画面で選んだ写真・動画を**モーダルで大きく見る**ための計算。**ここは純粋関数だけ**（約束 13）。
 *
 * 【初心者向け】なぜ画面から切り離すのか。
 *   モーダルを開くには「何番目を開くか」が要りますが、投稿画面の並びは
 *   **すでに付いている写真**と**これから足す写真・動画**の 2 つを繋いだものです（要件 4.5.1）。
 *   番号の数え間違いは画面を見ても気づきにくい（隣の写真が開くだけ）ので、
 *   番号の計算と鍵の読み方だけをここに出し、数字でテストできるようにしました。
 */

/** サムネイルの鍵。どちらなのかを 1 か所で決める（投稿画面と外すボタンが同じ読み方をするため） */
export type MediaKey = { kind: "new"; index: number } | { kind: "existing"; id: string };

const NEW_PREFIX = "new:";
const EXISTING_PREFIX = "existing:";

/** これから足すファイルの鍵（`files` の何番目か） */
export function newMediaKey(index: number): string {
  return `${NEW_PREFIX}${index}`;
}

/** すでに付いている写真・動画の鍵（保存済みの id） */
export function existingMediaKey(id: string): string {
  return `${EXISTING_PREFIX}${id}`;
}

/**
 * 鍵を読む。読めない鍵は `null`（古い鍵が残っていても落ちないように）。
 *
 * 【初心者向け】`new:3` の `3` を `Number()` に通すだけでは足りません。
 * `Number("")` は **0** なので、`new:` だけの鍵が**0 番目を指してしまいます**
 * （外すボタンから呼ぶと、先頭の写真が消えます）。数字だけが並んでいることを確かめます。
 */
export function parseMediaKey(key: string): MediaKey | null {
  if (key.startsWith(NEW_PREFIX)) {
    const digits = key.slice(NEW_PREFIX.length);
    return /^\d+$/.test(digits) ? { kind: "new", index: Number(digits) } : null;
  }
  if (key.startsWith(EXISTING_PREFIX)) {
    const id = key.slice(EXISTING_PREFIX.length);
    return id ? { kind: "existing", id } : null;
  }
  return null;
}

/**
 * サムネイルの並びを、モーダルが読める形に移す。
 *
 * 【初心者向け】写真は `fullUrl`、動画は `videoUrl` を見る部品なので（`MediaModal`）、
 * **同じ URL を両方に入れます**。投稿画面の URL はブラウザの中だけのもの 1 本きりで、
 * 大きい版・小さい版の区別がありません。
 */
export function toModalItems(items: readonly SelectedMedia[]): MediaItem[] {
  return items.map((item) => ({
    id: item.key,
    mediaType: item.mediaType,
    thumbnailUrl: item.url,
    fullUrl: item.url,
    videoUrl: item.mediaType === "video" ? item.url : undefined,
    alt: item.alt,
  }));
}

/** その鍵が並びの何番目か。無ければ `null`（外した直後などに開かないように） */
export function startIndexOf(items: readonly SelectedMedia[], key: string | null): number | null {
  if (key === null) return null;
  const index = items.findIndex((item) => item.key === key);
  return index === -1 ? null : index;
}

/**
 * モーダルの下に出す「切り取る」の文。**いまの長さを添える**
 * ── 押す前に「切る必要があるのか」が分かるように（要件 4.5.17）。
 */
export function trimEntryLabel(durationSeconds: number | null): string {
  return durationSeconds === null ? "切り取る" : `切り取る（いまは ${formatSeconds(durationSeconds)}）`;
}
