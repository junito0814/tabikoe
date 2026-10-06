import { describe, expect, it } from "vitest";
import { CLOSE_DISTANCE_PX, pullOffset, shouldCloseByPull } from "./use-pull-to-close";

/** 出典: Issue #804「シートに取っ手を付け、下に引いて閉じられるようにする」 */
describe("shouldCloseByPull（#804）", () => {
  it("80px 以上引いたら閉じる", () => {
    expect(shouldCloseByPull(CLOSE_DISTANCE_PX)).toBe(true);
    expect(shouldCloseByPull(200)).toBe(true);
  });

  it("途中で戻したら閉じない", () => {
    expect(shouldCloseByPull(CLOSE_DISTANCE_PX - 1)).toBe(false);
    expect(shouldCloseByPull(0)).toBe(false);
  });

  it("上に引いても閉じない", () => {
    expect(shouldCloseByPull(-120)).toBe(false);
  });
});

describe("pullOffset（#804）", () => {
  it("引いた分だけ下げる", () => {
    expect(pullOffset(40, false)).toBe(40);
  });

  it("上に引いても動かさない（シートは上には伸びない）", () => {
    expect(pullOffset(-40, false)).toBe(0);
  });

  it("「視差効果を減らす」人には動きを付けない", () => {
    expect(pullOffset(40, true)).toBe(0);
  });
});
