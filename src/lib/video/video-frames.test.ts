import { describe, expect, it } from "vitest";
import { FRAME_BUDGET_MS, FRAME_TARGET, frameTimes, shouldCaptureMore } from "./video-frames";

/**
 * #928: 帯に並べるコマ画像。**遅い端末で粘らない**ことがいちばん大事。
 *
 * 【初心者向け】絵そのものを作るところ（`captureFrames`）は `<video>` と `canvas` が要るので、
 *   ここでは試せません（jsdom は動画を解けない）。代わりに
 *   **どの時刻を取るか**と**いつ諦めるか**という判断だけを固めています。
 */
describe("frameTimes", () => {
  it("動画を等間隔に割り、真ん中寄りを取る（0 秒ちょうどは黒い場面が多い）", () => {
    expect(frameTimes(80, 8)).toEqual([5, 15, 25, 35, 45, 55, 65, 75]);
  });

  it("終わりちょうどは取らない（読めないことがある）", () => {
    expect(frameTimes(8, 8).at(-1)).toBeLessThan(8);
  });

  it("長さが分からない動画では 1 枚も作らない", () => {
    expect(frameTimes(0)).toEqual([]);
    expect(frameTimes(-5)).toEqual([]);
  });

  it("既定は 8 枚", () => {
    expect(frameTimes(60)).toHaveLength(FRAME_TARGET);
  });
});

describe("shouldCaptureMore（いつ諦めるか）", () => {
  it("1 枚目は必ず作る（速さが分からないので、測るために 1 枚は作る）", () => {
    expect(shouldCaptureMore({ captured: 0, target: 8, elapsedMs: 0 })).toBe(true);
  });

  it("速い端末では最後まで作る", () => {
    expect(shouldCaptureMore({ captured: 4, target: 8, elapsedMs: 200 })).toBe(true);
  });

  it("**遅い端末では途中でやめる**（1 枚 2 秒かかるなら、2 枚目で打ち切る）", () => {
    expect(shouldCaptureMore({ captured: 1, target: 8, elapsedMs: 2000 })).toBe(false);
  });

  it("持ち時間を使い切ったらやめる", () => {
    expect(shouldCaptureMore({ captured: 3, target: 8, elapsedMs: FRAME_BUDGET_MS })).toBe(false);
  });

  it("目標の枚数まで作ったらやめる", () => {
    expect(shouldCaptureMore({ captured: 8, target: 8, elapsedMs: 10 })).toBe(false);
  });
});
