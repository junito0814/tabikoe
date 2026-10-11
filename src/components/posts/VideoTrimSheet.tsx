"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useObjectUrls } from "@/components/media/SelectedMediaThumbnails";
import { Sheet } from "@/components/ui/Sheet";
import { formatSeconds } from "@/lib/posts/accept-media";
import {
  checkTrimFeasible,
  checkTrimmedOutput,
  MIN_TRIM_SECONDS,
  moveEnd,
  moveStart,
  moveWindow,
  planTrim,
  trimLengthSeconds,
  TRIM_WINDOW_SECONDS,
  trimFailureMessage,
  type TrimRange,
} from "@/lib/video/trim-plan";
import { captureFrames, frameTimes, waitForFrameData } from "@/lib/video/video-frames";
import { loadVideoForTrim, trimVideo, TrimError, type LoadedVideo } from "@/lib/video/trim-video";
import { readVideoDuration } from "@/lib/video/read-duration";

/**
 * #861 / 要件定義書 4.5.17（2026-10-10）: 動画の切り取り（SC-03 から出るシート）
 *
 * 【初心者向け】この画面がある理由。
 *   30 秒を超える動画を「写真アプリで編集してから選び直してください」と突き返すと、
 *   アプリを出て編集して戻ってくる**往復**が要ります。旅先でその場で投稿したい人には重い。
 *   だから**断らずに、その場で範囲を選ばせます**（Instagram と同じ作法）。
 *
 * ~~つまみは**開始位置だけ**を決め、長さは 30 秒で固定~~
 * → **2026-10-11（#928）に廃止**。実機で触って「両端を動かしたい・長さも自分で決めたい」という
 *   要望が出たため、**両端つまみ・長さ 1〜30 秒**にしました（iPhone の写真アプリと同じ作法）。
 *
 * **始まりだけ**キーフレーム（映像の出発点）に寄ります ── そこからしか画質を落とさずに
 * 切れないためです。終わりはどこでも止められます（終わりのコマは出発点である必要がない）。
 *
 * 帯にはコマ画像が並びますが、**絵を待たずに帯は動かせます**（#923 の轍を踏まないため）。
 *
 * **できなかったときは黙って失敗させない。** 読み込みでも切り取りでも、
 * 出来上がりの検査（`checkTrimmedOutput`）でつまずいたら、要件 4.5.17 の案内文に戻します。
 */
type Phase =
  | { kind: "loading" }
  | { kind: "ready" }
  /** 切り取り中。0〜1 の進み具合。「やめる」で中断できる（要件 4.5.11） */
  | { kind: "trimming"; progress: number };

export function VideoTrimSheet({
  file,
  durationSeconds,
  remaining = 1,
  onTrimmed,
  onGiveUp,
  onClose,
  load = loadVideoForTrim,
  trim = trimVideo,
  measure = readVideoDuration,
}: {
  file: File;
  /** 元の動画の長さ（秒）。投稿画面が選んだ時点で測っているので、測り直さない */
  durationSeconds: number;
  /**
   * この動画を含め、あと何本切り取ってもらうか。
   * 2 本以上なら見出しに「あと N 本」と出す ── 終わったと思って閉じられるのを防ぐ。
   */
  remaining?: number;
  /**
   * 切り取れた。このファイルを添付する。
   * #927: 長さも一緒に渡す ── 投稿画面が「切り取る（いまは 0:18）」を出すのに要るのに、
   * 測り直すと同じファイルをもう一度読むことになる（`checkTrimmedOutput` で測った値をそのまま渡す）。
   */
  onTrimmed: (trimmed: File, durationSeconds: number) => void;
  /** 切り取れなかった。受け取った文を投稿画面に出して、この動画は受け付けない */
  onGiveUp: (message: string) => void;
  /** 「×」や背景で閉じた（何も添付しない） */
  onClose: () => void;
  /** 差し替え口（単体テスト用） */
  load?: typeof loadVideoForTrim;
  trim?: typeof trimVideo;
  measure?: typeof readVideoDuration;
}) {
  const [loaded, setLoaded] = useState<LoadedVideo | null>(null);
  const [range, setRange] = useState<TrimRange>({ startSeconds: 0, endSeconds: TRIM_WINDOW_SECONDS });
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const previewFiles = useMemo(() => [file], [file]);
  const cancelledRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bandRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<number | null>(null);
  /**
   * #928: いま掴んでいるのは**始まり・終わり・範囲ごと**のどれか。
   * 掴んだ瞬間に決めて、指を離すまで変えない（途中で持ち替わると、指に付いてこない）。
   */
  const grabRef = useRef<{ part: "start" | "end" | "window"; offsetSeconds: number } | null>(null);
  /**
   * #928: 帯に並べるコマ画像。**場所は先に空けておき**、できたそばから埋める。
   * 間に合わなかったところは灰色のまま（帯はそれでも動かせる）。
   */
  const [frames, setFrames] = useState<Record<number, string>>({});
  const frameVideoRef = useRef<HTMLVideoElement | null>(null);

  /**
   * 動画の中身を見せる（通信なし。ブラウザの中だけで作る URL）。
   * 作り方・片付け方は選んだ写真のサムネイルと同じ部品を使う（約束 14）。
   */
  const previewUrl = useObjectUrls(previewFiles)[0]?.url ?? null;

  /**
   * #928: コマ画像を何枚並べるか（＝どの時刻を取るか）。
   * **絵が作れない端末でも場所は空けます** ── 帯の見た目が端末で変わらない方が分かりやすい。
   */
  const frameSlots = useMemo(() => (loaded ? frameTimes(loaded.durationSeconds) : []), [loaded]);

  // ---- 読み込み ----
  useEffect(() => {
    let alive = true;
    const run = async () => {
      /*
       * 始める前に断れるものは断る。数百 MB を読み込んでから落ちると、
       * 利用者には何が起きたのか分かりません。
       */
      const feasible = checkTrimFeasible({ sourceBytes: file.size, durationSeconds });
      if (!feasible.ok) {
        if (alive) onGiveUp(trimFailureMessage(feasible.reason, feasible.estimatedBytes));
        return;
      }
      try {
        const result = await load(file);
        if (!alive) return;
        setLoaded(result);
        setRange(planTrim({ keyframeTimes: result.keyframeTimes, durationSeconds: result.durationSeconds, wantStartSeconds: 0 }));
        setPhase({ kind: "ready" });
      } catch {
        if (!alive) return;
        // 読めない理由（対応していない・壊れている・途中で落ちた）はどれも案内は同じ
        onGiveUp(trimFailureMessage("unreadable"));
      }
    };
    void run();
    return () => {
      alive = false;
    };
    // onGiveUp は呼び出し側で作り直されても読み込みをやり直さない（同じファイルなら 1 回だけ）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, durationSeconds]);

  // ---- 選んだ位置の絵を出す ----
  useEffect(() => {
    const video = videoRef.current;
    if (!video || phase.kind !== "ready") return;
    // 読み込みが済む前に currentTime を入れても効かないので、整ってから入れる
    const seek = () => {
      try {
        video.currentTime = range.startSeconds;
      } catch {
        // 端末によっては指定できないことがある。絵が動かないだけなので何もしない
      }
    };
    if (video.readyState >= 1) seek();
    else video.addEventListener("loadedmetadata", seek, { once: true });
    return () => video.removeEventListener("loadedmetadata", seek);
  }, [range.startSeconds, phase.kind]);

  /*
   * #928: コマ画像を**後ろで**作る。帯はもう動かせる状態なので、ここで待たせない。
   *
   * 【初心者向け】なぜ別の `<video>` を使うのか。
   *   上の再生面を頭出しに使うと、**見ている絵が勝手に飛びます**（しかも操作と取り合う）。
   *   画面に出さない `<video>` を 1 つ置いて、そちらを頭出しします。
   *   読むのは同じブラウザ内の URL なので、通信は起きません。
   *
   * シートを閉じた・切り取りを始めたら止める（`cancelled`）。
   */
  useEffect(() => {
    if (phase.kind !== "ready" || !loaded) return;
    const video = frameVideoRef.current;
    if (!video) return;
    let cancelled = false;
    const run = async () => {
      if (!(await waitForFrameData(video)) || cancelled) return;
      await captureFrames(video, frameSlots, {
        onFrame: ({ index, url }) => setFrames((current) => ({ ...current, [index]: url })),
        isCancelled: () => cancelled,
      });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [phase.kind, loaded, frameSlots]);

  /** 選んだ範囲の中だけを繰り返す（はみ出したら頭に戻す） */
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.currentTime >= range.endSeconds - 0.05 || video.currentTime < range.startSeconds - 0.5) {
      video.currentTime = range.startSeconds;
    }
  };

  // ---- 帯のつまみ（#928: 両端 ＋ 真ん中） ----
  /** 指の位置を「動画の何秒か」に直す */
  const secondsAt = useCallback(
    (clientX: number): number | null => {
      const band = bandRef.current;
      if (!band || !loaded) return null;
      const box = band.getBoundingClientRect();
      if (box.width <= 0) return null;
      return ((clientX - box.left) / box.width) * loaded.durationSeconds;
    },
    [loaded]
  );

  /** つまみを掴んだと見なす幅（px）。指で掴める大きさ（要件 7.7 の 44px の半分ずつ） */
  const HANDLE_HIT_PX = 22;

  /**
   * 掴んだのはどこか。**端に近ければその端**、範囲の中なら範囲ごと。
   * 範囲の外を押したときは、近い端を掴んだことにする（押した場所へ飛ばさない ──
   * 指を置いただけで範囲が飛ぶと、やり直しが要る）。
   */
  const grabAt = (clientX: number): { part: "start" | "end" | "window"; offsetSeconds: number } | null => {
    const band = bandRef.current;
    const seconds = secondsAt(clientX);
    if (!band || !loaded || seconds === null) return null;
    const box = band.getBoundingClientRect();
    const toPx = (time: number) => box.left + (time / loaded.durationSeconds) * box.width;
    const startPx = toPx(range.startSeconds);
    const endPx = toPx(range.endSeconds);
    if (Math.abs(clientX - startPx) <= HANDLE_HIT_PX) return { part: "start", offsetSeconds: 0 };
    if (Math.abs(clientX - endPx) <= HANDLE_HIT_PX) return { part: "end", offsetSeconds: 0 };
    if (clientX > startPx && clientX < endPx) return { part: "window", offsetSeconds: seconds - range.startSeconds };
    return { part: clientX <= startPx ? "start" : "end", offsetSeconds: 0 };
  };

  const dragTo = useCallback(
    (clientX: number) => {
      const seconds = secondsAt(clientX);
      const grab = grabRef.current;
      if (!loaded || seconds === null || !grab) return;
      setRange((current) => {
        const common = { keyframeTimes: loaded.keyframeTimes, durationSeconds: loaded.durationSeconds, current };
        if (grab.part === "start") return moveStart({ ...common, wantStartSeconds: seconds });
        if (grab.part === "end") return moveEnd({ durationSeconds: loaded.durationSeconds, current, wantEndSeconds: seconds });
        return moveWindow({ ...common, wantStartSeconds: seconds - grab.offsetSeconds });
      });
    },
    [loaded, secondsAt]
  );

  const bandProps = {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      // シートの「下に引いて閉じる」と取り合わないように、ここで止める
      event.stopPropagation();
      dragRef.current = event.pointerId;
      grabRef.current = grabAt(event.clientX);
      event.currentTarget.setPointerCapture?.(event.pointerId);
      // 端を掴んだときだけ、その場で合わせる（範囲ごと掴んだときは動かさない）
      if (grabRef.current?.part !== "window") dragTo(event.clientX);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragRef.current !== event.pointerId) return;
      dragTo(event.clientX);
    },
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => {
      dragRef.current = null;
      grabRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    onPointerCancel: () => {
      dragRef.current = null;
      grabRef.current = null;
    },
  };

  /**
   * 矢印キーでも動かせるように（指で細かく合わせられない人のため）。
   * #928: どちらのつまみに焦点があるかで、動くものが変わる。
   */
  const onHandleKeyDown = (part: "start" | "end") => (event: React.KeyboardEvent) => {
    if (!loaded) return;
    const step = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : 0;
    if (step === 0) return;
    event.preventDefault();
    event.stopPropagation();
    setRange((current) =>
      part === "start"
        ? // 始まりはキーフレームへ寄るので、1 秒ずつ送れば次のキーフレームへ移る
          moveStart({ keyframeTimes: loaded.keyframeTimes, durationSeconds: loaded.durationSeconds, current, wantStartSeconds: current.startSeconds + step })
        : moveEnd({ durationSeconds: loaded.durationSeconds, current, wantEndSeconds: current.endSeconds + step })
    );
  };

  // ---- 決定 ----
  const apply = async () => {
    if (!loaded || phase.kind !== "ready") return;
    cancelledRef.current = false;
    setPhase({ kind: "trimming", progress: 0 });
    videoRef.current?.pause();
    try {
      const trimmed = await trim(loaded, range, {
        onProgress: (progress) => setPhase({ kind: "trimming", progress }),
        isCancelled: () => cancelledRef.current,
      });
      /*
       * **安全網。** できたファイルを `<video>` に読ませて測る。
       * 長さがおかしければ、壊れたものを上げずに案内へ戻す（PR #911 で約束したこと）。
       */
      const durationSeconds = await measure(trimmed);
      const checked = checkTrimmedOutput({ durationSeconds, sizeBytes: trimmed.size, expectedSeconds: range.endSeconds - range.startSeconds });
      if (!checked.ok) {
        onGiveUp(trimFailureMessage(checked.reason, trimmed.size));
        return;
      }
      onTrimmed(trimmed, checked.durationSeconds);
    } catch (error) {
      if (error instanceof TrimError && error.code === "cancelled") {
        setPhase({ kind: "ready" });
        return;
      }
      onGiveUp(trimFailureMessage("unreadable"));
    }
  };

  const windowPercent = loaded ? Math.min(100, (trimLengthSeconds(range) / loaded.durationSeconds) * 100) : 100;
  const leftPercent = loaded ? (range.startSeconds / loaded.durationSeconds) * 100 : 0;
  /** 選んでいる長さ（「26 秒」）。小数は出さない ── 1 コマぶんの差は伝えても意味がない */
  const lengthLabel = `${Math.max(1, Math.round(trimLengthSeconds(range)))} 秒`;
  /** 読み上げ用。「0:13 から 0:39 まで、26 秒」と、両端と長さをまとめて伝える */
  const rangeText = `${formatSeconds(range.startSeconds)} から ${formatSeconds(range.endSeconds)} まで、${lengthLabel}`;

  return (
    <Sheet
      open
      title={remaining > 1 ? `切り取る範囲を選ぶ（あと ${remaining} 本）` : "切り取る範囲を選ぶ"}
      onClose={phase.kind === "trimming" ? () => undefined : onClose}
      footer={
        phase.kind === "trimming" ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[0.8125rem] text-muted">
              <span>切り取っています…</span>
              <span>{Math.round(phase.progress * 100)}%</span>
            </div>
            {/* 進み具合。読み上げでも伝わるように role="progressbar" を付ける */}
            <div role="progressbar" aria-label="切り取りの進み具合" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(phase.progress * 100)} className="h-1.5 overflow-hidden rounded-full bg-tint">
              <div className="h-full rounded-full bg-accent transition-[width] duration-150" style={{ width: `${Math.round(phase.progress * 100)}%` }} />
            </div>
            <button
              type="button"
              onClick={() => {
                cancelledRef.current = true;
              }}
              className="h-11 w-full rounded-[10px] border border-line bg-surface text-[0.875rem] font-semibold text-ink"
            >
              やめる
            </button>
          </div>
        ) : (
          <button type="button" onClick={apply} disabled={phase.kind !== "ready"} className="h-11 w-full rounded-[10px] bg-accent text-[0.875rem] font-bold text-white disabled:opacity-50">
            この範囲にする
          </button>
        )
      }
    >
      <div className="flex flex-col gap-3">
        {/* 再生面。縦の動画でも収まるように高さを決めて、中に合わせる */}
        <div className="flex h-[44dvh] max-h-[360px] items-center justify-center overflow-hidden rounded-[12px] bg-tint">
          {previewUrl && (
            <video
              ref={videoRef}
              src={previewUrl}
              playsInline
              muted
              controls={phase.kind === "ready"}
              onTimeUpdate={handleTimeUpdate}
              className="h-full w-full object-contain"
            />
          )}
        </div>

        {/*
          * コマ画像づくり専用の `<video>`。画面には出さない（`hidden` でも絵は取り出せる）。
          * `preload="metadata"` のまま ── 全部読まないことは #923 で決めたこと。
          */}
        {previewUrl && <video ref={frameVideoRef} src={previewUrl} preload="metadata" muted playsInline hidden />}

        {phase.kind === "loading" ? (
          <p className="py-2 text-center text-[0.8125rem] text-muted">動画を読み込んでいます…</p>
        ) : (
          <>
            {/*
              * 帯（#928）。全体の長さを横幅にして、選んでいるところを明るく出す。
              * 後ろにコマ画像が並び、**間に合わなかったところは灰色のまま**になる。
              *
              * 読み上げのために、つまみ 2 つをそれぞれ `role="slider"` にしてある
              * （帯そのものは入れ物。どちらのつまみを動かすのかが言えないと伝わらない）。
              */}
            <div ref={bandRef} {...bandProps} className="relative h-14 w-full touch-none overflow-hidden rounded-[10px] bg-tint">
              {/* コマ画像。絵が無いところは灰色（帯は絵を待たずに動かせる） */}
              <div className="absolute inset-0 flex" aria-hidden>
                {frameSlots.map((_, index) => (
                  <span
                    key={index}
                    className="h-full flex-1 bg-line/60 bg-cover bg-center"
                    style={frames[index] ? { backgroundImage: `url(${frames[index]})` } : undefined}
                    data-frame={frames[index] ? "ready" : "pending"}
                  />
                ))}
              </div>
              {/* 選んでいないところを暗くする（選んだところが浮き上がって見える） */}
              <div className="absolute inset-y-0 left-0 bg-black/45" style={{ width: `${leftPercent}%` }} aria-hidden />
              <div className="absolute inset-y-0 right-0 bg-black/45" style={{ width: `${Math.max(0, 100 - leftPercent - windowPercent)}%` }} aria-hidden />
              <div
                className="absolute inset-y-0 flex items-stretch rounded-[8px] ring-2 ring-inset ring-accent"
                style={{ left: `${leftPercent}%`, width: `${windowPercent}%` }}
              >
                {/*
                  * 両端の「掴むところ」。動画の切り取りでよく見る形に合わせ、
                  * **塗りつぶした帯の中に白い縦棒**を入れて、掴めることが分かるようにする。
                  */}
                <span
                  role="slider"
                  tabIndex={0}
                  aria-label="切り取りの始まり"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(range.endSeconds - MIN_TRIM_SECONDS)}
                  aria-valuenow={Math.round(range.startSeconds)}
                  aria-valuetext={rangeText}
                  onKeyDown={onHandleKeyDown("start")}
                  className="flex w-4 shrink-0 cursor-ew-resize items-center justify-center rounded-l-[8px] bg-accent outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span className="h-5 w-0.5 rounded-full bg-white/90" />
                </span>
                <span className="flex-1" />
                <span
                  role="slider"
                  tabIndex={0}
                  aria-label="切り取りの終わり"
                  aria-valuemin={Math.round(range.startSeconds + MIN_TRIM_SECONDS)}
                  aria-valuemax={loaded ? Math.round(Math.min(loaded.durationSeconds, range.startSeconds + TRIM_WINDOW_SECONDS)) : 0}
                  aria-valuenow={Math.round(range.endSeconds)}
                  aria-valuetext={rangeText}
                  onKeyDown={onHandleKeyDown("end")}
                  className="flex w-4 shrink-0 cursor-ew-resize items-center justify-center rounded-r-[8px] bg-accent outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span className="h-5 w-0.5 rounded-full bg-white/90" />
                </span>
              </div>
            </div>
            {/* 帯の両端が動画のどこかを示す（全体の長さ） */}
            <div className="flex justify-between text-[0.6875rem] text-muted">
              <span>0:00</span>
              <span>{loaded ? formatSeconds(loaded.durationSeconds) : ""}</span>
            </div>
            {/*
              * #928: 範囲と**長さ**の両方を出す。
              * 長さが分からないと「30 秒以内に収まったのか」が利用者に分からない。
              */}
            <p className="text-center text-[0.875rem] font-semibold text-ink">
              {formatSeconds(range.startSeconds)} 〜 {formatSeconds(range.endSeconds)}
              <span className="ml-2 tabular-nums text-accent">{lengthLabel}</span>
            </p>
            <p className="text-center text-[0.75rem] text-muted">
              両端のつまみで長さを決められます（{MIN_TRIM_SECONDS} 〜 {TRIM_WINDOW_SECONDS} 秒）。真ん中を動かすと長さを保ったまま移ります
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}
