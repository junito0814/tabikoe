/**
 * #928 / 要件定義書 4.5.17（2026-10-11）: 切り取りの帯に並べる**コマ画像**。
 *
 * 【初心者向け】なぜここが危ないのか。
 *   コマ画像は「`<video>` の再生位置を動かして、`canvas` に 1 枚ずつ描き写す」やり方で作ります。
 *   **1 枚ごとに動画を頭出しする**ので、大きな動画では 1 枚に何百ミリ秒もかかることがあります。
 *   #923 で「動画を選んでから使えるまでが長い」と言われたばかりなので、**同じことを繰り返さない**。
 *
 *   そこでこうしました。
 *     - 帯は**コマ画像を待たずに動かせる**（絵は後から埋まる）
 *     - **1 枚目を作ってから速さを測り**、間に合わないと分かったらそこでやめる（灰色のまま）
 *     - シートを閉じたら止める
 *
 *   「何枚にするか」を先に決め打ちせず、**走りながら測って決める**のが肝です。
 *   実機の速さは端末によって何倍も違うので、手元で測った 1 つの数字を信じるより確かです。
 */

/** 並べたいコマの枚数（出発点）。間に合わなければ、ここに届かないまま止まる */
export const FRAME_TARGET = 8;

/**
 * コマ画像づくりに使ってよい時間の合計（ミリ秒）。
 *
 * 【初心者向け】3 秒を選んだ理由。帯はもう動かせる状態なので、この間も操作は止まりません。
 * 絵が揃うのを待つ人はいないが、3 秒以上かかると「結局埋まらない」ことが多く、
 * 画面の後ろで動画を頭出しし続けるだけ損になります。
 */
export const FRAME_BUDGET_MS = 3000;

/**
 * コマを取り出す時刻（秒）。動画全体を等間隔に割る。
 *
 * 【初心者向け】最初と最後を避けて**真ん中寄り**を取ります。
 * 0 秒ちょうどは黒い場面が多く、終わりちょうどは読めないことがあるためです。
 */
export function frameTimes(durationSeconds: number, count: number = FRAME_TARGET): number[] {
  if (!(durationSeconds > 0) || count <= 0) return [];
  const step = durationSeconds / count;
  return Array.from({ length: count }, (_, i) => Math.min(durationSeconds - 0.01, step * (i + 0.5)));
}

/**
 * **もう 1 枚作ってよいか。** いま作り終えた枚数と、そこまでにかかった時間で決める。
 *
 * 1 枚あたりの平均で次の 1 枚ぶんを見込み、**持ち時間に収まるときだけ**続ける。
 * 速い端末では最後まで並び、遅い端末では途中で止まる（灰色のまま使える）。
 */
export function shouldCaptureMore(input: { captured: number; target: number; elapsedMs: number }): boolean {
  if (input.captured >= input.target) return false;
  if (input.captured === 0) return true;
  const perFrame = input.elapsedMs / input.captured;
  return input.elapsedMs + perFrame <= FRAME_BUDGET_MS;
}

/** コマ画像の横幅（px）。帯の高さに合わせた小さな絵でよい（文字は読まない） */
const FRAME_WIDTH = 64;

export interface CapturedFrame {
  /** 何番目か（`frameTimes` の添字） */
  index: number;
  /** `canvas` から取り出した画像（data URL） */
  url: string;
}

/**
 * コマ画像を**1 枚ずつ**作る。できたそばから `onFrame` で渡すので、
 * 画面は待たずに埋めていける。
 *
 * `isCancelled` が true になったら、その場でやめる（シートを閉じたとき）。
 * 失敗しても投げない ── **絵が無くても切り取りはできる**ので、黙って諦める方が良い。
 */
export async function captureFrames(
  video: HTMLVideoElement,
  times: readonly number[],
  options: { onFrame: (frame: CapturedFrame) => void; isCancelled: () => boolean }
): Promise<void> {
  if (typeof document === "undefined" || times.length === 0) return;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return;

  const startedAt = Date.now();
  for (let index = 0; index < times.length; index++) {
    if (options.isCancelled()) return;
    if (!shouldCaptureMore({ captured: index, target: times.length, elapsedMs: Date.now() - startedAt })) return;
    try {
      await seekTo(video, times[index]);
      if (options.isCancelled()) return;
      const height = video.videoHeight && video.videoWidth ? Math.round((FRAME_WIDTH * video.videoHeight) / video.videoWidth) : FRAME_WIDTH;
      canvas.width = FRAME_WIDTH;
      canvas.height = Math.max(1, height);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      options.onFrame({ index, url: canvas.toDataURL("image/jpeg", 0.5) });
    } catch {
      // この 1 枚は諦めて次へ（灰色のまま）
    }
  }
}

/** その時刻の絵が出るまで待つ。待ちすぎないように打ち切る */
function seekTo(video: HTMLVideoElement, seconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      video.removeEventListener("seeked", done);
      reject(new Error("seek timeout"));
    }, 1500);
    function done() {
      clearTimeout(timer);
      video.removeEventListener("seeked", done);
      resolve();
    }
    video.addEventListener("seeked", done, { once: true });
    try {
      video.currentTime = seconds;
    } catch {
      clearTimeout(timer);
      video.removeEventListener("seeked", done);
      reject(new Error("seek failed"));
    }
  });
}

/**
 * コマを描ける状態（絵が 1 枚でも読めている）になるまで待つ。
 * 待ちすぎないように打ち切り、打ち切ったら false を返す（コマ画像は諦める）。
 */
export function waitForFrameData(video: HTMLVideoElement, timeoutMs = 4000): Promise<boolean> {
  if (video.readyState >= 2) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      video.removeEventListener("loadeddata", done);
      resolve(false);
    }, timeoutMs);
    function done() {
      clearTimeout(timer);
      video.removeEventListener("loadeddata", done);
      resolve(true);
    }
    video.addEventListener("loadeddata", done, { once: true });
  });
}
