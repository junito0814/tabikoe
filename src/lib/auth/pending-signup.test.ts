import { describe, expect, it } from "vitest";
import { isAllowedWhilePendingSignup, pendingSignupAction } from "./pending-signup";

/**
 * 出典: docs/tasks/account/signup-login/11-google-once-signup.md 単体テスト
 * - 登録待ちは /signup・/login・/api/auth/* だけ通り、他の画面は /signup へ、他の API は 401
 */
describe("pending-signup（認証済みだが未登録の人が開ける場所）", () => {
  it("同意画面・ログイン画面・認証 API は通す", () => {
    for (const path of ["/signup", "/login", "/api/auth/signup", "/api/auth/signup/cancel", "/api/auth/logout", "/api/auth/callback"]) {
      expect(isAllowedWhilePendingSignup(path)).toBe(true);
      expect(pendingSignupAction(path)).toEqual({ kind: "pass" });
    }
  });

  it("他の画面は同意画面へ、他の API は 401", () => {
    expect(pendingSignupAction("/")).toEqual({ kind: "redirect", to: "/signup" });
    expect(pendingSignupAction("/mypage")).toEqual({ kind: "redirect", to: "/signup" });
    expect(pendingSignupAction("/search")).toEqual({ kind: "redirect", to: "/signup" });
    expect(pendingSignupAction("/api/posts")).toEqual({ kind: "api_denied" });
    expect(pendingSignupAction("/api/notifications/unread-count")).toEqual({ kind: "api_denied" });
  });
});
