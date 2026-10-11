"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useObjectUrls } from "@/components/media/SelectedMediaThumbnails";
import { Sheet } from "@/components/ui/Sheet";
import { formatSeconds } from "@/lib/posts/accept-media";
import {
  checkTrimFeasible,
  checkTrimmedOutput,
  maxStartSeconds,
  planTrim,
  TRIM_WINDOW_SECONDS,
  trimFailureMessage,
  type TrimRange,
} from "@/lib/video/trim-plan";
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
 * つまみは**開始位置だけ**を決め、長さは 30 秒で固定です（要件 4.5.17）。
 * 選べる位置はキーフレーム（映像の出発点）に寄ります ── そこからしか画質を落とさずに切れないためです。
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
   * 動画の中身を見せる（通信なし。ブラウザの中だけで作る URL）。
   * 作り方・片付け方は選んだ写真のサムネイルと同じ部品を使う（約束 14）。
   */
  const previewUrl = useObjectUrls(previewFiles)[0]?.url ?? null;

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

  /** 選んだ範囲の中だけを繰り返す（はみ出したら頭に戻す） */
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.currentTime >= range.endSeconds - 0.05 || video.currentTime < range.startSeconds - 0.5) {
      video.currentTime = range.startSeconds;
    }
  };

  // ---- 帯のつまみ ----
  const moveTo = useCallback(
    (clientX: number) => {
      const band = bandRef.current;
      if (!band || !loaded) return;
      const box = band.getBoundingClientRect();
      const windowWidth = (TRIM_WINDOW_SECONDS / loaded.durationSeconds) * box.width;
      // つまみの**左端**を合わせる（指の位置はつまみの中心）
      const ratio = (clientX - box.left - windowWidth / 2) / Math.max(box.width - windowWidth, 1);
      const limit = maxStartSeconds(loaded.durationSeconds);
      setRange(planTrim({ keyframeTimes: loaded.keyframeTimes, durationSeconds: loaded.durationSeconds, wantStartSeconds: ratio * limit }));
    },
    [loaded]
  );

  const bandProps = {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      // シートの「下に引いて閉じる」と取り合わないように、ここで止める
      event.stopPropagation();
      dragRef.current = event.pointerId;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      moveTo(event.clientX);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragRef.current !== event.pointerId) return;
      moveTo(event.clientX);
    },
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    onPointerCancel: () => {
      dragRef.current = null;
    },
  };

  /** 矢印キーでも動かせるように（指で細かく合わせられない人のため） */
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!loaded) return;
    const step = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : 0;
    if (step === 0) return;
    event.preventDefault();
    // キーフレームへ寄せるので、1 秒ずつ送れば次のキーフレームへ移る
    setRange(planTrim({ keyframeTimes: loaded.keyframeTimes, durationSeconds: loaded.durationSeconds, wantStartSeconds: range.startSeconds + step * 1 }));
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

  const windowPercent = loaded ? Math.min(100, (TRIM_WINDOW_SECONDS / loaded.durationSeconds) * 100) : 100;
  const leftPercent = loaded ? (range.startSeconds / loaded.durationSeconds) * 100 : 0;

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

        {phase.kind === "loading" ? (
          <p className="py-2 text-center text-[0.8125rem] text-muted">動画を読み込んでいます…</p>
        ) : (
          <>
            {/*
              * 帯。全体の長さを横幅にして、選んでいる 30 秒を明るく出す。
              * `role="slider"` にしてあるので、読み上げでも「何秒から」が伝わる。
              */}
            <div
              ref={bandRef}
              {...bandProps}
              role="slider"
              tabIndex={0}
              aria-label="切り取りを始める位置"
              aria-valuemin={0}
              aria-valuemax={loaded ? Math.round(maxStartSeconds(loaded.durationSeconds)) : 0}
              aria-valuenow={Math.round(range.startSeconds)}
              aria-valuetext={`${formatSeconds(range.startSeconds)} から ${formatSeconds(range.endSeconds)} まで`}
              onKeyDown={onKeyDown}
              className="relative h-14 w-full touch-none overflow-hidden rounded-[10px] bg-tint"
            >
              <div className="absolute inset-y-0 flex items-stretch rounded-[8px] bg-accent/15 ring-2 ring-inset ring-accent" style={{ left: `${leftPercent}%`, width: `${windowPercent}%` }}>
                {/*
                  * 両端の「掴むところ」。動画の切り取りでよく見る形に合わせ、
                  * **塗りつぶした帯の中に白い縦棒**を入れて、掴めることが分かるようにする。
                  */}
                <span className="flex w-4 shrink-0 items-center justify-center rounded-l-[8px] bg-accent">
                  <span className="h-5 w-0.5 rounded-full bg-white/90" />
                </span>
                <span className="flex-1" />
                <span className="flex w-4 shrink-0 items-center justify-center rounded-r-[8px] bg-accent">
                  <span className="h-5 w-0.5 rounded-full bg-white/90" />
                </span>
              </div>
            </div>
            {/* 帯の両端が動画のどこかを示す（全体の長さ） */}
            <div className="flex justify-between text-[0.6875rem] text-muted">
              <span>0:00</span>
              <span>{loaded ? formatSeconds(loaded.durationSeconds) : ""}</span>
            </div>
            <p className="text-center text-[0.875rem] font-semibold text-ink">
              {formatSeconds(range.startSeconds)} 〜 {formatSeconds(range.endSeconds)} を切り取ります
            </p>
            {/*
              * #927（2026-10-11）: 文を 2 通りにした。
              *
              * モーダルから「切り取る」を押せるようになったので、**30 秒より短い動画でも
              * このシートが開きます**。そのときは帯が全体を覆って動かないので、
              * 「帯を動かすと…長さは 30 秒です」は嘘になります。
              * 長さを自分で決められるようにするのは #928。
              */}
            <p className="text-center text-[0.75rem] text-muted">
              {loaded && maxStartSeconds(loaded.durationSeconds) > 0
                ? `帯を動かすと始まりの位置が変わります。長さは ${TRIM_WINDOW_SECONDS} 秒です`
                : `この動画は ${TRIM_WINDOW_SECONDS} 秒より短いので、全体がそのまま入ります`}
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}
