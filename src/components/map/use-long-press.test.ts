import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLongPressDetector, LONG_PRESS_MS, type LongPressDetector } from "./use-long-press";

/**
 * 出典: docs/tasks/map-search/pin-interaction-v3/02-long-press.md 単体テスト
 * - 500ms 未満・移動あり・ドラッグ中で発火しないこと、500ms 静止で発火すること（タイマーをモック）
 */
describe("createLongPressDetector", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("500ms 静止で発火する", () => {
    const onLongPress = vi.fn();
    const detector = createLongPressDetector(onLongPress);
    detector.start({ lat: 35, lng: 139, x: 0, y: 0 });
    vi.advanceTimersByTime(LONG_PRESS_MS - 1);
    expect(onLongPress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLongPress).toHaveBeenCalledWith({ lat: 35, lng: 139 });
    expect(detector.isPending()).toBe(false);
  });

  it("500ms 未満で離したら発火しない", () => {
    const onLongPress = vi.fn();
    const detector = createLongPressDetector(onLongPress);
    detector.start({ lat: 35, lng: 139 });
    vi.advanceTimersByTime(200);
    detector.cancel();
    vi.advanceTimersByTime(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("10px を超えて動いたら発火しない（それ以下なら発火する）", () => {
    const onLongPress = vi.fn();
    const detector = createLongPressDetector(onLongPress);
    detector.start({ lat: 35, lng: 139, x: 0, y: 0 });
    detector.move({ lat: 35, lng: 139, x: 5, y: 5 });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(onLongPress).toHaveBeenCalledTimes(1);

    detector.start({ lat: 35, lng: 139, x: 0, y: 0 });
    detector.move({ lat: 35, lng: 139, x: 20, y: 0 });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("ドラッグ開始（cancel）で発火しない", () => {
    const onLongPress = vi.fn();
    const detector = createLongPressDetector(onLongPress);
    detector.start({ lat: 35, lng: 139 });
    detector.cancel();
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("右クリック（trigger）は即時に発火する", () => {
    const onLongPress = vi.fn();
    const detector = createLongPressDetector(onLongPress);
    detector.trigger({ lat: 1, lng: 2 });
    expect(onLongPress).toHaveBeenCalledWith({ lat: 1, lng: 2 });
  });
});

/*
 * #866（2026-10-07）: 長押しのあと指を離すと、地図が**ふつうのタップ**を出す。
 * そのタップで吹き出しが消えてしまっていたので、直後の 1 回だけ飲み込めること。
 */
describe("長押しの直後のタップ（#866）", () => {
  it("長押しが成立したら、次のタップを 1 回だけ飲み込む", () => {
    const fired: { lat: number; lng: number }[] = [];
    let run: (() => void) | null = null;
    const detector: LongPressDetector = createLongPressDetector((point) => fired.push(point), {
      setTimer: (fn) => {
        run = fn;
        return 1;
      },
      clearTimer: () => {
        run = null;
      },
    });

    detector.start({ lat: 35, lng: 139, x: 0, y: 0 });
    runPending(run);
    expect(fired).toHaveLength(1);

    // 指を離した瞬間のタップは無視する
    expect(detector.consumeClickAfterLongPress()).toBe(true);
    // 次のタップはふつうに効く（吹き出しを消せる）
    expect(detector.consumeClickAfterLongPress()).toBe(false);
  });

  it("長押ししていないただのタップは飲み込まない", () => {
    const detector = createLongPressDetector(() => {});
    expect(detector.consumeClickAfterLongPress()).toBe(false);
  });

  it("右クリック（即時の長押し）のあとも 1 回だけ飲み込む", () => {
    const fired: { lat: number; lng: number }[] = [];
    const detector = createLongPressDetector((point) => fired.push(point));
    detector.trigger({ lat: 35, lng: 139 });
    expect(fired).toHaveLength(1);
    expect(detector.consumeClickAfterLongPress()).toBe(true);
    expect(detector.consumeClickAfterLongPress()).toBe(false);
  });

  it("動かして取り消したときは飲み込まない（長押しが成立していない）", () => {
    let run: (() => void) | null = null;
    const detector: LongPressDetector = createLongPressDetector(() => {}, {
      setTimer: (fn) => {
        run = fn;
        return 1;
      },
      clearTimer: () => {
        run = null;
      },
    });
    detector.start({ lat: 35, lng: 139, x: 0, y: 0 });
    detector.move({ lat: 35, lng: 139, x: 100, y: 100 });
    expect(run).toBeNull();
    expect(detector.consumeClickAfterLongPress()).toBe(false);
  });
});

/** 【初心者向け】`let run: (() => void) | null` に差し替え関数から代入すると、TS は「まだ null のまま」と見る。
 *  いったん変数に受けてから呼ぶ（テストだけの都合） */
function runPending(fn: (() => void) | null): void {
  if (fn) fn();
}
