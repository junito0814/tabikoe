import { describe, expect, it } from "vitest";
import {
  activeStrikeCount,
  countReliableReporters,
  DEFAULT_MODERATION_SETTINGS as S,
  describeMeasure,
  isPostingRestricted,
  isSevereReason,
  measureForStrikeCount,
  restrictionUntil,
  shouldAutoHide,
  strikeExpiresAt,
} from "./strike-rules";

/** 出典: docs/tasks/safety/strike-system/01-strike-rules-and-data.md 単体テスト */
const now = new Date("2026-09-27T00:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
const strike = (createdDaysAgo: number, revoked = false) => ({
  createdAt: daysAgo(createdDaysAgo),
  expiresAt: new Date(now.getTime() - (createdDaysAgo - 90) * 86400000).toISOString(),
  revokedAt: revoked ? daysAgo(1) : null,
});

describe("有効なストライク", () => {
  it("91 日前のものと取り消し済みのものは数に入らない", () => {
    expect(activeStrikeCount([strike(1), strike(89), strike(91), strike(10, true)], now)).toBe(2);
  });

  it("失効日は付与日＋90 日", () => {
    expect(strikeExpiresAt(new Date("2026-09-01T00:00:00Z"), S).toISOString()).toBe("2026-11-30T00:00:00.000Z");
  });
});

describe("段階（3.10.7）", () => {
  it("1 → 警告、2 → 3 日、3 → 7 日、4 → 30 日、5 → 仮停止", () => {
    expect(measureForStrikeCount(1, S)).toEqual({ kind: "warn" });
    expect(measureForStrikeCount(2, S)).toEqual({ kind: "restrict", days: 3 });
    expect(measureForStrikeCount(3, S)).toEqual({ kind: "restrict", days: 7 });
    expect(measureForStrikeCount(4, S)).toEqual({ kind: "restrict", days: 30 });
    expect(measureForStrikeCount(5, S)).toEqual({ kind: "suspend" });
    expect(measureForStrikeCount(7, S)).toEqual({ kind: "suspend" });
    expect(measureForStrikeCount(0, S)).toEqual({ kind: "none" });
  });

  it("しきい値を変えると段階も変わる（設定値をコードに直書きしていない）", () => {
    const custom = { ...S, strikesToSuspend: 3, restrictionDays: [1, 5] };
    expect(measureForStrikeCount(1, custom)).toEqual({ kind: "restrict", days: 1 });
    expect(measureForStrikeCount(3, custom)).toEqual({ kind: "suspend" });
  });

  it("措置の日本語と解除日時", () => {
    expect(describeMeasure({ kind: "restrict", days: 3 })).toBe("3日間 投稿・コメント禁止");
    expect(describeMeasure({ kind: "suspend" })).toBe("仮停止");
    expect(restrictionUntil({ kind: "restrict", days: 3 }, now)?.toISOString()).toBe("2026-09-30T00:00:00.000Z");
    expect(restrictionUntil({ kind: "warn" }, now)).toBeNull();
    expect(isPostingRestricted(daysAgo(-1), now)).toBe(true);
    expect(isPostingRestricted(daysAgo(1), now)).toBe(false);
    expect(isPostingRestricted(null, now)).toBe(false);
  });
});

describe("重大な違反", () => {
  it("個人情報の掲載・なりすましだけが 1 回で仮停止", () => {
    expect(isSevereReason("personal_info")).toBe(true);
    expect(isSevereReason("impersonation")).toBe(true);
    expect(isSevereReason("inappropriate")).toBe(false);
    expect(isSevereReason("spam")).toBe(false);
  });
});

describe("自動非公開（3.10.8）", () => {
  const none = new Map<string, number>();

  it("異なる通報者 3 人で真、同じ人が 3 回では偽", () => {
    expect(shouldAutoHide([{ reporterId: "a" }, { reporterId: "b" }, { reporterId: "c" }], none, S)).toBe(true);
    expect(shouldAutoHide([{ reporterId: "a" }, { reporterId: "a" }, { reporterId: "a" }], none, S)).toBe(false);
    expect(shouldAutoHide([{ reporterId: "a" }, { reporterId: "b" }], none, S)).toBe(false);
  });

  it("「問題なし」が 3 件以上の通報者は数えない", () => {
    const unreliable = new Map([["c", 3]]);
    expect(countReliableReporters([{ reporterId: "a" }, { reporterId: "b" }, { reporterId: "c" }], unreliable, S)).toBe(2);
    expect(shouldAutoHide([{ reporterId: "a" }, { reporterId: "b" }, { reporterId: "c" }], unreliable, S)).toBe(false);
    // 2 件ならまだ数える
    expect(shouldAutoHide([{ reporterId: "a" }, { reporterId: "b" }, { reporterId: "c" }], new Map([["c", 2]]), S)).toBe(true);
  });
});
