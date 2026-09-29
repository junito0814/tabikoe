import { describe, expect, it } from "vitest";
import { ADMIN_MFA_VERIFIED_COOKIE, mfaVerifiedCookieOptions, parseMfaVerifiedAt } from "./mfa-verified-cookie";
import { ADMIN_SESSION_MAX_AGE_SECONDS } from "./mfa-gate";

/** 出典: docs/tasks/admin/admin-login/05-mfa-screen.md 単体テスト（確認時刻の Cookie） */
describe("parseMfaVerifiedAt", () => {
  it("書いた時刻を読み戻せる", () => {
    const now = 1_790_000_000_000;
    expect(parseMfaVerifiedAt(String(now))).toBe(now);
  });

  it("無い・壊れている値は未確認として扱う", () => {
    expect(parseMfaVerifiedAt(undefined)).toBeNull();
    expect(parseMfaVerifiedAt(null)).toBeNull();
    expect(parseMfaVerifiedAt("")).toBeNull();
    expect(parseMfaVerifiedAt("abc")).toBeNull();
    expect(parseMfaVerifiedAt("0")).toBeNull();
    expect(parseMfaVerifiedAt("-1")).toBeNull();
  });
});

describe("mfaVerifiedCookieOptions", () => {
  it("ブラウザの JS から読めない・書けない属性にする", () => {
    const options = mfaVerifiedCookieOptions(true);
    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("lax");
    // /api/admin/... からも読めるようにする
    expect(options.path).toBe("/");
  });

  it("有効期間を 60 分に合わせる（期限が来たら Cookie ごと消え、未確認になる）", () => {
    expect(mfaVerifiedCookieOptions(false).maxAge).toBe(ADMIN_SESSION_MAX_AGE_SECONDS);
  });

  it("Cookie 名は 1 か所で決める", () => {
    expect(ADMIN_MFA_VERIFIED_COOKIE).toBe("tabikoe-admin-mfa");
  });
});
