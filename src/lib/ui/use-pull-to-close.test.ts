import { describe, expect, it } from "vitest";
import { CLOSE_DISTANCE_PX, canPullFromContent, pullOffset, shouldCloseByPull } from "./use-pull-to-close";

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

/**
 * #885（2026-10-09）: シートの中身のどこからでも下にスライドして閉じられるようにした。
 *
 * 【初心者向け】取っ手の棒だけが掴めた頃は、スクロールと取り合う心配がなかった
 * （棒はスクロールする場所の外にあるため）。中身からも引けるようにすると、
 * **途中で下に引いたときに一覧が動かなくなる**。いちばん上にいるときだけ引き始める。
 */
describe("中身から引き始めてよいか（#885）", () => {
  it("いちばん上にいるときは引ける", () => {
    expect(canPullFromContent(0)).toBe(true);
  });

  it("少しでもスクロールしていたら引かない（一覧のスクロールを優先する）", () => {
    expect(canPullFromContent(1)).toBe(false);
    expect(canPullFromContent(300)).toBe(false);
  });

  it("iOS の跳ね返りで負になっても引ける", () => {
    expect(canPullFromContent(-12)).toBe(true);
  });
});
