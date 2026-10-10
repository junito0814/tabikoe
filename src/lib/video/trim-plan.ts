import { MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_SIZE_BYTES } from "@/lib/video/limits";

/**
 * #861 / 要件定義書 4.5.17（2026-10-10）: 動画のどこを切り取るかの計算と、
 * 切り取った結果を受け付けてよいかの判断。**ここは純粋関数だけ**（約束 13）。
 *
 * 【初心者向け】なぜ画面から切り離すのか。
 *   切り取りの画面は「指で帯をなぞる」「mp4box を読み込む」といった、
 *   テストで動かしにくいものを抱えています。**どこを切るか・結果を通すか**という
 *   いちばん間違えたくない部分だけをここへ出し、数字だけでテストできるようにしました。
 */

/** 切り取る長さは 30 秒で固定（要件 4.5.17: つまみは開始位置だけを決める） */
export const TRIM_WINDOW_SECONDS = MAX_VIDEO_DURATION_SECONDS;

/**
 * 切り取る前の動画の大きさの上限。
 *
 * 【初心者向け】切り取りは**ファイル全体をいったんメモリに読み込みます**。
 * 数百 MB の動画でこれをやると、スマホのブラウザが落ちます（落ちると、
 * 何が起きたのか利用者には分かりません）。読み込む前に断って案内します。
 */
export const MAX_TRIM_SOURCE_BYTES = 300 * 1024 * 1024;

/**
 * 切り取ってもなお大きすぎると**見込んだ**ときに断るための余裕。
 *
 * 見込みは「元の大きさ ÷ 元の長さ × 30 秒」でしかなく、動画の中で画質が
 * 一定とは限りません。**見込みで断るのは明らかに無理なときだけ**にして、
 * 本当の大きさは切り取ったあとに測ります（`checkTrimmedOutput`）。
 */
export const TRIM_ESTIMATE_MARGIN = 1.3;

/** つまみを動かせる右端。これより後ろから 30 秒は取れない */
export function maxStartSeconds(durationSeconds: number): number {
  return Math.max(0, durationSeconds - TRIM_WINDOW_SECONDS);
}

/**
 * 要求された開始位置を、**いちばん近いキーフレーム**へ寄せる。
 *
 * 【初心者向け】なぜキーフレームなのか。
 *   動画は全コマを丸ごと記録しているのではなく、「前のコマからの差分」で持っています。
 *   丸ごと記録してある出発点が**キーフレーム**で、2 秒に 1 回くらい入っています。
 *   差分のコマから切り出すと、出発点が無いので**最初の数秒が崩れます**。
 *   作り直さずに（画質を落とさずに）切るには、キーフレームから始めるしかありません。
 *
 * 近い方へ寄せるのは、**画面に出す数字と実際に切る位置を合わせる**ためです。
 * いつも手前へ寄せると、選んだ覚えのない数秒が頭に入ります。
 * ちょうど真ん中（前後が同じ距離）のときは**後ろ**を採ります
 * ── 選んだ位置より前の映像を入れない方に倒しておきます。
 */
export function snapToKeyframe(keyframeTimes: readonly number[], wantSeconds: number): number {
  if (keyframeTimes.length === 0) return wantSeconds;
  let best = keyframeTimes[0];
  for (const time of keyframeTimes) {
    if (Math.abs(time - wantSeconds) <= Math.abs(best - wantSeconds)) best = time;
  }
  return best;
}

export interface TrimRange {
  startSeconds: number;
  endSeconds: number;
}

/**
 * つまみの位置から、実際に切り取る範囲を決める。
 *
 * 順番が大事。**先に動かせる範囲へ収め、そのあとキーフレームへ寄せる。**
 * 逆にすると、寄せた先が右端を越えて 30 秒に足りなくなることがあります。
 */
export function planTrim(input: { keyframeTimes: readonly number[]; durationSeconds: number; wantStartSeconds: number }): TrimRange {
  const limit = maxStartSeconds(input.durationSeconds);
  const clamped = Math.min(Math.max(input.wantStartSeconds, 0), limit);
  // 寄せ先の候補も右端までに限る（右端を越えたキーフレームへ寄せると 30 秒に足りない）
  const candidates = input.keyframeTimes.filter((time) => time >= 0 && time <= limit + 0.001);
  const startSeconds = snapToKeyframe(candidates, clamped);
  return { startSeconds, endSeconds: Math.min(startSeconds + TRIM_WINDOW_SECONDS, input.durationSeconds) };
}

/** 見込みの大きさ。元の動画が一定の画質だと仮定した、ざっくりした値 */
export function estimateTrimmedBytes(sourceBytes: number, durationSeconds: number, windowSeconds: number = TRIM_WINDOW_SECONDS): number {
  if (durationSeconds <= 0) return sourceBytes;
  return Math.round((sourceBytes * Math.min(windowSeconds, durationSeconds)) / durationSeconds);
}

/** 始める前に分かる断り方 */
export type TrimRefusal = "source_too_large" | "estimated_too_large";
/** 切り取ったあとに分かる断り方 */
export type TrimOutputRefusal = "unreadable" | "too_long" | "too_short" | "too_large";

export type TrimFeasibility = { ok: true } | { ok: false; reason: TrimRefusal; estimatedBytes: number };

/**
 * 切り取りを**始めてよいか**。始めてから落ちるより、始める前に断る方が親切。
 */
export function checkTrimFeasible(input: { sourceBytes: number; durationSeconds: number }): TrimFeasibility {
  const estimatedBytes = estimateTrimmedBytes(input.sourceBytes, input.durationSeconds);
  if (input.sourceBytes > MAX_TRIM_SOURCE_BYTES) return { ok: false, reason: "source_too_large", estimatedBytes };
  if (estimatedBytes > MAX_VIDEO_SIZE_BYTES * TRIM_ESTIMATE_MARGIN) return { ok: false, reason: "estimated_too_large", estimatedBytes };
  return { ok: true };
}

/**
 * 切り取った結果が短くなりすぎていないかを見る余裕（秒）。
 *
 * ぴったり 30 秒にはなりません。最後のコマが 30 秒の線をまたぐときは**入れない**ので
 * （またぐと 30 秒を超えてサーバーに断られる）、コマ 1 枚ぶんだけ短くなります。
 */
export const TRIM_LENGTH_TOLERANCE_SECONDS = 1.5;

export type TrimmedOutputCheck =
  | { ok: true; durationSeconds: number }
  | { ok: false; reason: TrimOutputRefusal };

/**
 * **安全網（PR #911 で約束したもの）。** 切り取ったファイルを `<video>` に読ませて測り、
 * おかしければ**壊れたものを上げずに案内へ戻す**。
 *
 * 【初心者向け】なぜ必要なのか。
 *   mp4box での切り取りが端末によってどう転ぶかは、手元では確かめきれません。
 *   「できたつもり」で壊れた動画を上げると、**投稿一覧に再生できない投稿が残ります**。
 *   出来上がりを測ってから渡せば、失敗は案内に変わるだけで済みます。
 */
export function checkTrimmedOutput(input: { durationSeconds: number | null; sizeBytes: number; expectedSeconds: number }): TrimmedOutputCheck {
  if (input.durationSeconds === null) return { ok: false, reason: "unreadable" };
  if (input.durationSeconds > MAX_VIDEO_DURATION_SECONDS) return { ok: false, reason: "too_long" };
  if (input.durationSeconds < input.expectedSeconds - TRIM_LENGTH_TOLERANCE_SECONDS) return { ok: false, reason: "too_short" };
  if (input.sizeBytes > MAX_VIDEO_SIZE_BYTES) return { ok: false, reason: "too_large" };
  return { ok: true, durationSeconds: input.durationSeconds };
}

/** 切り取れなかったときの案内（要件 4.5.17 の「逃げ道」の文） */
export const TRIM_FALLBACK_MESSAGE = `この端末では動画を切り取れませんでした。写真アプリで ${MAX_VIDEO_DURATION_SECONDS} 秒以内に編集してから選び直してください`;

/** MB 表示（小数 1 桁。0.1MB 未満は切り上げて「0.1MB」にする） */
export function formatMegabytes(bytes: number): string {
  return `${Math.max(0.1, Math.round((bytes / 1024 / 1024) * 10) / 10)}MB`;
}

/**
 * 切り取りがうまくいかなかったときに出す文。**「できません」で終わらせない**（要件 4.5.11）。
 * 大きすぎるときだけは原因が違うので、別の文にする（短くしても直らない）。
 */
export function trimFailureMessage(reason: TrimRefusal | TrimOutputRefusal, bytes?: number): string {
  if (reason === "source_too_large" || reason === "estimated_too_large" || reason === "too_large") {
    const size = bytes === undefined ? "" : `（${formatMegabytes(bytes)}）`;
    return `この動画は画質が高く、${TRIM_WINDOW_SECONDS} 秒に切り取っても ${MAX_VIDEO_SIZE_BYTES / 1024 / 1024}MB を超えます${size}。写真アプリで短く編集してから選び直してください`;
  }
  return TRIM_FALLBACK_MESSAGE;
}
