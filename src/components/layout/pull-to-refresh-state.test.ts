import { describe, expect, it } from "vitest";
import {
  canStartPull,
  gearOpacity,
  gearRotation,
  PULL_MAX_PX,
  PULL_THRESHOLD_PX,
  pullDistance,
  shouldRefresh,
} from "./pull-to-refresh-state";

/**
 * 出典: docs/tasks/shared-ui/loading-feedback/09-pull-to-refresh.md 単体テスト
 * 要件定義書 4.5.11 の場面 6・8 章 96
 *
 * 【初心者向け】指の動きは機械で再現しにくいので、**判断だけ**をここで確かめる（約束 13）。
 * いちばん怖いのは**誤爆**（普通にスクロールしただけで勝手に読み込み直す）なので、
 * そこを重点的に見る。
 */
describe("canStartPull: いつ引きはじめてよいか", () => {
  it("いちばん上にいるときだけ引きはじめられる", () => {
    expect(canStartPull({ scrollTop: 0, isRefreshing: false })).toBe(true);
  });

  it("途中までスクロールしていたら引きはじめない（誤爆を防ぐ）", () => {
    expect(canStartPull({ scrollTop: 1, isRefreshing: false })).toBe(false);
    expect(canStartPull({ scrollTop: 500, isRefreshing: false })).toBe(false);
  });

  it("iOS の跳ね返りで scrollTop が負になっても引きはじめられる", () => {
    expect(canStartPull({ scrollTop: -12, isRefreshing: false })).toBe(true);
  });

  it("取り直している間は受け付けない（二重に走らせない）", () => {
    expect(canStartPull({ scrollTop: 0, isRefreshing: true })).toBe(false);
  });
});

describe("pullDistance: 指の動きから歯車を下ろす距離", () => {
  it("上に動かしたぶんは無視する", () => {
    expect(pullDistance(300, 300)).toBe(0);
    expect(pullDistance(300, 280)).toBe(0);
  });

  it("指の動きの半分だけ下ろす（軽すぎて誤爆しないように）", () => {
    expect(pullDistance(100, 200)).toBe(50);
  });

  it("上限を超えて下がらない", () => {
    expect(pullDistance(0, 10000)).toBe(PULL_MAX_PX);
  });
});

describe("shouldRefresh: 離したときに取り直すか", () => {
  it("しきい値に届かなければ取り直さない", () => {
    expect(shouldRefresh(0)).toBe(false);
    expect(shouldRefresh(PULL_THRESHOLD_PX - 1)).toBe(false);
  });

  it("しきい値に届いたら取り直す", () => {
    expect(shouldRefresh(PULL_THRESHOLD_PX)).toBe(true);
    expect(shouldRefresh(PULL_MAX_PX)).toBe(true);
  });

  it("しきい値に届くには指を 120px 動かす必要がある（半分しか下がらないため）", () => {
    // 軽く払っただけでは届かないことを数字で押さえておく
    expect(shouldRefresh(pullDistance(0, 119))).toBe(false);
    expect(shouldRefresh(pullDistance(0, 120))).toBe(true);
  });
});

describe("歯車の見え方", () => {
  it("しきい値でちょうど 1 回転する（一周したら離せばよいと分かる）", () => {
    expect(gearRotation(0)).toBe(0);
    expect(gearRotation(PULL_THRESHOLD_PX)).toBe(360);
  });

  it("しきい値でちょうど濃さが 1 になる", () => {
    expect(gearOpacity(0)).toBe(0);
    expect(gearOpacity(PULL_THRESHOLD_PX / 2)).toBe(0.5);
    expect(gearOpacity(PULL_THRESHOLD_PX)).toBe(1);
  });

  it("しきい値を超えても濃さは 1 を超えない", () => {
    expect(gearOpacity(PULL_MAX_PX)).toBe(1);
  });
});
