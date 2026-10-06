import { describe, expect, it } from "vitest";
import { isSpotSaved } from "./is-spot-saved";

/** 出典: Issue #758「Bug 5: 行きたい・しおりから外しても「＋」に戻らず「✓」のまま」 */
describe("isSpotSaved（#758）", () => {
  it("行きたいにもしおりにも入っていなければ ＋（false）", () => {
    expect(isSpotSaved(false, false)).toBe(false);
  });

  it("行きたいに入っていれば ✓", () => {
    expect(isSpotSaved(true, false)).toBe(true);
  });

  it("どれかのしおりに入っていれば ✓", () => {
    expect(isSpotSaved(false, true)).toBe(true);
  });

  it("両方に入っていれば ✓", () => {
    expect(isSpotSaved(true, true)).toBe(true);
  });

  it("片方だけ外しても、もう片方に残っていれば ✓ のまま", () => {
    // 行きたいを外した（しおりには残っている）
    expect(isSpotSaved(false, true)).toBe(true);
    // しおりから外した（行きたいには残っている）
    expect(isSpotSaved(true, false)).toBe(true);
  });
});
