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

/**
 * 切り取れる長さの上限。サーバーが受け付ける上限と同じ（要件 5.4）。
 *
 * ~~2026-10-10: 長さは 30 秒で固定（つまみは開始位置だけを決める）~~
 * → **2026-10-11（#928）に廃止**。両端を動かして**長さも自分で決める**ようにした
 *   （iPhone の写真アプリと同じ作法）。この値は「ここまで」の意味に変わった。
 */
export const TRIM_WINDOW_SECONDS = MAX_VIDEO_DURATION_SECONDS;

/**
 * 切り取れる長さの下限（#928）。
 *
 * 【初心者向け】なぜ下限が要るのか。
 *   つまみを重ねると長さ 0 になり、**コマが 1 枚も入っていない動画**が出来ます。
 *   出来上がったものは再生できず、何が悪いのか利用者には分かりません。
 *   「1 秒より短くはできない」と決めて、つまみの段階で止めます。
 */
export const MIN_TRIM_SECONDS = 1;

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

/**
 * **最長（30 秒）を取るときの**始まりの右端。これより後ろから 30 秒は取れない。
 *
 * #928 以降、つまみはここより後ろへも動かせる（長さが短くなるだけ）。
 * この関数は「初めの範囲」を決めるときと、長さ 30 秒のときの限界を知るのに使う。
 */
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

/** 選んでいる長さ（秒） */
export function trimLengthSeconds(range: TrimRange): number {
  return range.endSeconds - range.startSeconds;
}

/**
 * #928: **始まりのつまみ**を動かす。
 *
 * 始まりはキーフレームへ寄せる（そこからしか画質を落とさずに切れない）。
 * 終わりは動かさない ── ただし長さが 1〜30 秒から外れるときだけ、終わりも連れて動かす。
 *
 * 【初心者向け】なぜ「寄せる前に収める」のか。
 *   先に寄せると、寄せ先が終わりを越えてしまうことがあります（長さが負になる）。
 *   **動かせる範囲へ収める → 寄せる → もう一度収める**の順にします。
 */
export function moveStart(input: {
  keyframeTimes: readonly number[];
  durationSeconds: number;
  current: TrimRange;
  wantStartSeconds: number;
}): TrimRange {
  const limit = Math.max(0, input.current.endSeconds - MIN_TRIM_SECONDS);
  const clamped = Math.min(Math.max(input.wantStartSeconds, 0), Math.max(limit, 0));
  const candidates = input.keyframeTimes.filter((time) => time >= 0 && time <= limit + 0.001);
  const startSeconds = snapToKeyframe(candidates, clamped);
  // 長すぎるときだけ終わりを引き寄せる（始まりを動かして 30 秒を超えることがある）
  const endSeconds = Math.min(input.current.endSeconds, startSeconds + TRIM_WINDOW_SECONDS);
  return { startSeconds, endSeconds };
}

/**
 * #928: **終わりのつまみ**を動かす。
 *
 * 終わりは**どこでも止められる**（キーフレームへ寄せない）。終わりのコマは丸ごと入れるか
 * 入れないかだけなので、出発点である必要がないためです。
 */
export function moveEnd(input: { durationSeconds: number; current: TrimRange; wantEndSeconds: number }): TrimRange {
  const start = input.current.startSeconds;
  const lowest = start + MIN_TRIM_SECONDS;
  const highest = Math.min(input.durationSeconds, start + TRIM_WINDOW_SECONDS);
  return { startSeconds: start, endSeconds: Math.min(Math.max(input.wantEndSeconds, lowest), highest) };
}

/**
 * #928: **真ん中を掴んで範囲ごと動かす**（iPhone の写真アプリと同じ）。
 *
 * **長さを変えない**のが肝です。始まりをキーフレームへ寄せたぶん、終わりも同じだけ動かします
 * （寄せて長さが変わると、掴んで動かしただけで長さが勝手に伸び縮みして気持ちが悪い）。
 * 端に当たったら、そこで止まります。
 */
export function moveWindow(input: {
  keyframeTimes: readonly number[];
  durationSeconds: number;
  current: TrimRange;
  wantStartSeconds: number;
}): TrimRange {
  const length = trimLengthSeconds(input.current);
  const limit = Math.max(0, input.durationSeconds - length);
  const clamped = Math.min(Math.max(input.wantStartSeconds, 0), limit);
  const candidates = input.keyframeTimes.filter((time) => time >= 0 && time <= limit + 0.001);
  const startSeconds = snapToKeyframe(candidates, clamped);
  return { startSeconds, endSeconds: Math.min(startSeconds + length, input.durationSeconds) };
}

/** 見込みの大きさ。元の動画が一定の画質だと仮定した、ざっくりした値 */
export function estimateTrimmedBytes(sourceBytes: number, durationSeconds: number, windowSeconds: number = TRIM_WINDOW_SECONDS): number {
  if (durationSeconds <= 0) return sourceBytes;
  return Math.round((sourceBytes * Math.min(windowSeconds, durationSeconds)) / durationSeconds);
}

/**
 * 始める前に分かる断り方。
 *
 * #974（2026-10-17）: ~~`source_too_large`~~ を**ここから外した**。
 * 大きさの門は「丸ごと読む」直前（`loadVideoForTrim` の保険の手前）へ移した。
 * 理由は、切り取りは**ファイルを丸ごと読んでいない**こと ── 目次は 1MB ずつ覗いて探し、
 * 切り取りは選んだ範囲のぶんだけ開く。**危ないのは目次が見つからなかったときの保険だけ**で、
 * 入り口で厚さを測って索引を見せずに追い返していた。
 */
export type TrimRefusal = "estimated_too_large";
/** 切り取ったあとに分かる断り方 */
export type TrimOutputRefusal = "unreadable" | "too_long" | "too_short" | "too_large";

export type TrimFeasibility = { ok: true } | { ok: false; reason: TrimRefusal; estimatedBytes: number };

/**
 * 切り取りを**始めてよいか**。始めてから落ちるより、始める前に断る方が親切。
 */
export function checkTrimFeasible(input: { sourceBytes: number; durationSeconds: number }): TrimFeasibility {
  const estimatedBytes = estimateTrimmedBytes(input.sourceBytes, input.durationSeconds);
  // #974: 大きさでは断らない。大きくても目次が見つかれば切り取れるので、まず試す
  if (estimatedBytes > MAX_VIDEO_SIZE_BYTES * TRIM_ESTIMATE_MARGIN) return { ok: false, reason: "estimated_too_large", estimatedBytes };
  return { ok: true };
}

/**
 * 切り取った結果が、選んだ長さからどれだけずれていいか（秒）。
 *
 * ぴったりにはなりません。最後のコマが線をまたぐときは**入れない**ので
 * （またぐと長くなり、30 秒を超えればサーバーに断られる）、コマ 1 枚ぶんだけ短くなります。
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
  /*
   * #928: **選んだ長さと合っているか**を見る。
   *
   * 長さが 30 秒固定だったときは「30 秒に近いか」だけ見ていればよかったが、
   * 自分で決められるようになったので、**選んだより長く出来てしまった場合**も
   * つかまえる必要がある（5 秒を選んだのに 20 秒出来たら、それは切れていない）。
   */
  if (input.durationSeconds > input.expectedSeconds + TRIM_LENGTH_TOLERANCE_SECONDS) return { ok: false, reason: "too_long" };
  if (input.durationSeconds < input.expectedSeconds - TRIM_LENGTH_TOLERANCE_SECONDS) return { ok: false, reason: "too_short" };
  if (input.sizeBytes > MAX_VIDEO_SIZE_BYTES) return { ok: false, reason: "too_large" };
  return { ok: true, durationSeconds: input.durationSeconds };
}

/**
 * #941（2026-10-17）: 切り取っても 50MB を超えるとき、**何秒なら入るか**を見込む（純粋関数。約束 13）。
 *
 * 【初心者向け】画質の高い動画（4K60 など）は、30 秒に切り取っても 50MB を超えることがあります。
 * そのとき「大きすぎます」とだけ言われても、**何秒にすればいいのか分かりません**。
 * 出来上がったファイルの大きさと長さが分かっていれば、1 秒あたりの大きさが出せます。
 *
 *     1 秒あたりの大きさ ＝ 切り取った大きさ ÷ 切り取った秒数
 *     入る秒数           ＝ 50MB ÷ 1 秒あたりの大きさ
 *
 * **安全側に削ります。** 切り取りは開始位置をキーフレームに寄せるので、頼んだ長さより
 * 少し長い出力になることがあります（`TRIM_LENGTH_TOLERANCE_SECONDS`）。ぎりぎりの秒数を
 * 出すと、やり直してもまた超えて二度手間になります。
 */
export const TRIM_FIT_SAFETY_RATIO = 0.9;

export type TrimFitAdvice =
  /** そのままで入る（短くする必要がない） */
  | { kind: "fits" }
  /** ここまで短くすれば入る */
  | { kind: "shorten"; seconds: number }
  /** 1 秒まで削っても入らない。画質を落としてもらうしかない */
  | { kind: "impossible" };

export function adviseTrimFit(input: { bytes: number; seconds: number }): TrimFitAdvice {
  if (input.bytes <= MAX_VIDEO_SIZE_BYTES) return { kind: "fits" };
  // 長さが 0 や、読めない値のときは見込みを立てられない（0 で割らない）
  if (!Number.isFinite(input.seconds) || input.seconds <= 0 || !Number.isFinite(input.bytes) || input.bytes <= 0) return { kind: "impossible" };

  const bytesPerSecond = input.bytes / input.seconds;
  const raw = (MAX_VIDEO_SIZE_BYTES / bytesPerSecond) * TRIM_FIT_SAFETY_RATIO;
  const seconds = Math.floor(raw);
  if (seconds < MIN_TRIM_SECONDS) return { kind: "impossible" };
  return { kind: "shorten", seconds: Math.min(seconds, MAX_VIDEO_DURATION_SECONDS) };
}

/**
 * #941: 切り取りのシートの中にそのまま出す文（**シートを閉じない**）。
 *
 * 【初心者向け】つまみは 1〜30 秒で動かせる（#928）ので、**逃げ道が同じ画面にあります**。
 * 閉じてしまうと、選び直しからやり直しになります。
 */
export function trimTooLargeMessage(advice: TrimFitAdvice, bytes: number): string {
  if (advice.kind === "shorten") {
    return `この画質だと ${TRIM_WINDOW_SECONDS} 秒でも ${MAX_VIDEO_SIZE_BYTES / 1024 / 1024}MB を超えます（${formatMegabytes(bytes)}）。${advice.seconds} 秒まで短くすると入ります`;
  }
  // 1 秒でも入らない。アプリの中で画質を落とす（再エンコード）は #861 で「やらない」と決めている
  return `この動画は画質が高すぎて、1 秒に切り取っても ${MAX_VIDEO_SIZE_BYTES / 1024 / 1024}MB を超えます（${formatMegabytes(bytes)}）。写真アプリで画質を落としてから選び直してください`;
}

/** 切り取れなかったときの案内（要件 4.5.17 の「逃げ道」の文） */
export const TRIM_FALLBACK_MESSAGE = `この端末では動画を切り取れませんでした。写真アプリで ${MAX_VIDEO_DURATION_SECONDS} 秒以内に編集してから選び直してください`;

/** MB 表示（小数 1 桁。0.1MB 未満は切り上げて「0.1MB」にする） */
export function formatMegabytes(bytes: number): string {
  return `${Math.max(0.1, Math.round((bytes / 1024 / 1024) * 10) / 10)}MB`;
}

/**
 * #970（2026-10-17）: **元のファイルが大きすぎて、そもそも開けない**ときの文。
 *
 * 【初心者向け】ここは「画質が高い」話ではありません。`MAX_TRIM_SOURCE_BYTES` は
 * **読み込むと端末が落ちる**ので手前で止める上限で、**中身はまだ一度も見ていません**。
 * それなのに「30 秒に切り取っても 50MB を超えます（92.9MB）」と出していました。
 * 92.9MB は**切ったらこれくらいという見込み**で、実物ではありません。
 * 651MB のファイルに 92.9MB とだけ出ても、何の数字か分かりません。
 *
 * そこで、**起きていることをそのまま言います** ── 実際の大きさと、上限はいくつか。
 *
 * なお **iPhone は写真アプリの動画をそのまま渡しません**（HEVC を H.264 に変換して渡す）。
 * 写真アプリに出ている数字とここの数字は**ずれます**。だからこそ、
 * **ブラウザが受け取った実際の大きさ**を出す意味があります。
 *
 * #974（2026-10-17）: この文が出る**場面が狭まりました**。以前は読み込む前に大きさだけで
 * 出していたので、300MB を 0.1% 超えただけの動画も門前払いでした。いまは
 * **目次探し（1MB ずつ）と切り取り（選んだ範囲だけ）を先に試し**、目次が見つからず
 * 「丸ごと読む」しかないときだけ出ます ── つまり**本当に読めない動画だけ**です。
 */
export function trimSourceTooLargeMessage(sourceBytes: number): string {
  return `この動画は ${formatMegabytes(sourceBytes)} で、この画面では開けません（上限 ${MAX_TRIM_SOURCE_BYTES / 1024 / 1024}MB）。写真アプリで短く切ってから選び直してください`;
}

/**
 * 切り取りがうまくいかなかったときに出す文。**「できません」で終わらせない**（要件 4.5.11）。
 * 大きすぎるときだけは原因が違うので、別の文にする（短くしても直らない）。
 *
 * #970: **「大きすぎて開けない」はここでは扱いません**。理由が違うので言うべきことも違います
 * → `trimSourceTooLargeMessage`。
 * #974: その断り方は `TrimRefusal`（始める前に分かるもの）から外れ、`TrimError("source_too_large")`
 * （丸ごと読む直前で投げるもの）になったので、**型で弾くための `Exclude` は要らなくなりました**。
 */
export function trimFailureMessage(reason: TrimRefusal | TrimOutputRefusal, bytes?: number): string {
  if (reason === "estimated_too_large" || reason === "too_large") {
    const size = bytes === undefined ? "" : `（${formatMegabytes(bytes)}）`;
    return `この動画は画質が高く、${TRIM_WINDOW_SECONDS} 秒に切り取っても ${MAX_VIDEO_SIZE_BYTES / 1024 / 1024}MB を超えます${size}。写真アプリで短く編集してから選び直してください`;
  }
  return TRIM_FALLBACK_MESSAGE;
}
