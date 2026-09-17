import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLongPressDetector, LONG_PRESS_MS } from "./use-long-press";

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
