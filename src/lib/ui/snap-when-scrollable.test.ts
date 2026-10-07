import { describe, expect, it } from "vitest";
import { shouldSnap, SNAP_HEADROOM_RATIO } from "./snap-when-scrollable";

/**
 * #867 の判断のテスト。
 * 実測（隅田公園の桜並木。投稿 1 件・390×844）: ページ 1208px・画面 844px・地図 287px
 * → 送れるのは 364px しかなく、2 つめの吸い付き（287px）を 77px 超えるだけだった。
 */
describe("shouldSnap", () => {
  it("投稿が 1 件で中身が短いときは吸い付かせない（#867 の再現値）", () => {
    expect(shouldSnap({ scrollHeight: 1208, viewportHeight: 844, snapOffset: 287 })).toBe(false);
  });

  it("投稿が多くてよく送れるときは吸い付かせる", () => {
    expect(shouldSnap({ scrollHeight: 4000, viewportHeight: 844, snapOffset: 287 })).toBe(true);
  });

  it("2 つめの吸い付き位置に届かないときは吸い付かせない（落ち着き先が 1 つしかない）", () => {
    expect(shouldSnap({ scrollHeight: 1000, viewportHeight: 844, snapOffset: 287 })).toBe(false);
  });

  it("境目: 2 つめの吸い付きを画面の 1/4 だけ超えたら吸い付かせる", () => {
    const viewportHeight = 800;
    const snapOffset = 300;
    const headroom = viewportHeight * SNAP_HEADROOM_RATIO; // 200
    const just = { scrollHeight: viewportHeight + snapOffset + headroom, viewportHeight, snapOffset };
    expect(shouldSnap(just)).toBe(true);
    expect(shouldSnap({ ...just, scrollHeight: just.scrollHeight - 1 })).toBe(false);
  });

  it("おかしな値では吸い付かせない（高さが取れていないとき）", () => {
    expect(shouldSnap({ scrollHeight: 0, viewportHeight: 0, snapOffset: 0 })).toBe(false);
    expect(shouldSnap({ scrollHeight: 2000, viewportHeight: 844, snapOffset: 0 })).toBe(false);
  });
});
