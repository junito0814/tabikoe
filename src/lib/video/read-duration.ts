"use client";

/**
 * #861（2026-10-09）: 選んだ瞬間に、動画の長さをブラウザで読む。
 *
 * 【初心者向け】なぜサーバーに送る前に見るのか。
 *   50MB を送り終えてから「長すぎます」と言われるのは、待たせたうえに無駄です。
 *   ブラウザは `<video>` にファイルを渡すだけで長さを知れます（数十ミリ秒、通信なし）。
 *
 * 読めなかったときは `null` を返します。**そこで断ってはいけません** ──
 * 読めない理由は「その端末がこの形式を再生できない」だけのこともあり、
 * 中身が H.264 かどうかは**サーバーが中身を見て判断する**のが正です（要件 5.4）。
 * ここは「明らかに長すぎるものを早く断る」ための前さばきに留めます。
 */
export const DURATION_READ_TIMEOUT_MS = 5000;

export function readVideoDuration(file: File, timeoutMs: number = DURATION_READ_TIMEOUT_MS): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let done = false;

    const finish = (value: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      URL.revokeObjectURL(url);
      resolve(value);
    };

    // 壊れたファイルや、その端末が再生できない形式だと `loadedmetadata` が来ないことがある
    const timer = setTimeout(() => finish(null), timeoutMs);

    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      const duration = video.duration;
      finish(Number.isFinite(duration) && duration > 0 ? duration : null);
    };
    video.onerror = () => finish(null);
    video.src = url;
  });
}
