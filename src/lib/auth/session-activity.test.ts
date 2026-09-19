import { describe, expect, it } from "vitest";
import {
  buildExpiredLoginPath,
  isSessionExpiredByInactivity,
  LAST_ACTIVE_TOUCH_INTERVAL_MS,
  parseLastActive,
  SESSION_INACTIVITY_LIMIT_MS,
  shouldTouchLastActive,
} from "./session-activity";

/**
 * 出典: docs/tasks/account/session-management/03-refresh-token-expiry-rule.md 単体テスト
 * - 最終利用日時が30日以内なら自動リフレッシュが許可される（失効とみなさない）
 * - 最終利用日時が30日を超過していればリフレッシュを行わず再ログイン要求に分岐する
 */
const now = Date.parse("2026-09-19T12:00:00Z");
const day = 24 * 60 * 60 * 1000;

describe("session-activity（30 日失効ルール）", () => {
  it("最終利用が 30 日以内なら失効しない（境界: ちょうど 30 日は失効しない）", () => {
    expect(isSessionExpiredByInactivity(now - 29 * day, now)).toBe(false);
    expect(isSessionExpiredByInactivity(now - SESSION_INACTIVITY_LIMIT_MS, now)).toBe(false);
  });

  it("最終利用が 30 日を超えていれば失効（再ログイン）", () => {
    expect(isSessionExpiredByInactivity(now - 30 * day - 1, now)).toBe(true);
    expect(isSessionExpiredByInactivity(now - 45 * day, now)).toBe(true);
  });

  it("記録が無ければ失効とはみなさない（今から数え始める）", () => {
    expect(isSessionExpiredByInactivity(null, now)).toBe(false);
  });

  it("Cookie の値は epoch ミリ秒。壊れていれば null", () => {
    expect(parseLastActive(String(now))).toBe(now);
    expect(parseLastActive("abc")).toBeNull();
    expect(parseLastActive("")).toBeNull();
    expect(parseLastActive(undefined)).toBeNull();
    expect(parseLastActive("-5")).toBeNull();
  });

  it("最終利用日時の書き直しは記録が無いときと 1 時間以上空いたときだけ", () => {
    expect(shouldTouchLastActive(null, now)).toBe(true);
    expect(shouldTouchLastActive(now - 5 * 60 * 1000, now)).toBe(false);
    expect(shouldTouchLastActive(now - LAST_ACTIVE_TOUCH_INTERVAL_MS, now)).toBe(true);
  });

  it("失効時のログイン URL は error=expired と元の遷移先。ログイン画面自体なら redirect_to 無し", () => {
    expect(buildExpiredLoginPath("/mypage")).toBe("/login?error=expired&redirect_to=%2Fmypage");
    expect(buildExpiredLoginPath("/login")).toBe("/login?error=expired");
    expect(buildExpiredLoginPath("/signup")).toBe("/login?error=expired");
  });
});
