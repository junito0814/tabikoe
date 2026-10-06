import { describe, expect, it, vi } from "vitest";
import { HIGHLIGHT_MS, scrollBehaviorFor, scrollRowIntoView } from "./scroll-to-row";

/** 出典: Issue #761 */
describe("scrollBehaviorFor（#761）", () => {
  it("「視差効果を減らす」を入れている人には滑らかに動かさない", () => {
    expect(scrollBehaviorFor(() => ({ matches: true }))).toBe("auto");
  });

  it("入れていなければ滑らかに動かす", () => {
    expect(scrollBehaviorFor(() => ({ matches: false }))).toBe("smooth");
  });

  it("matchMedia が無い環境では安全側（滑らかにしない）", () => {
    expect(scrollBehaviorFor(undefined)).toBe("auto");
  });

  it("聞く条件は prefers-reduced-motion: reduce", () => {
    const matchMedia = vi.fn(() => ({ matches: false }));
    scrollBehaviorFor(matchMedia);
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });
});

describe("scrollRowIntoView（#761）", () => {
  it("見えていなければ最小限だけ動かす（nearest）── 見えている行は動かさない", () => {
    const scrollIntoView = vi.fn();
    scrollRowIntoView({ scrollIntoView } as unknown as Element, "smooth");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
  });

  it("行が無い／scrollIntoView が無い環境では何もしない（落ちない）", () => {
    expect(() => scrollRowIntoView(null, "auto")).not.toThrow();
    expect(() => scrollRowIntoView({} as Element, "auto")).not.toThrow();
  });
});

describe("光らせる長さ", () => {
  it("1.5 秒", () => {
    expect(HIGHLIGHT_MS).toBe(1500);
  });
});
