import { describe, expect, it } from "vitest";
import { hasFullConsent } from "./consent";

/**
 * 出典: docs/tasks/account/signup-login/07-consent-flow.md 単体テスト
 * - 利用規約・個人情報保護方針のどちらかが false または未送信なら同意なし（アカウントを作らない）
 */
describe("hasFullConsent（同意は 2 つとも必須）", () => {
  it("terms=1 と privacy=1 がそろって初めて同意あり", () => {
    expect(hasFullConsent(new URLSearchParams("terms=1&privacy=1"))).toBe(true);
  });

  it("どちらか一方だけ・旧 consent=1 だけ・未送信は同意なし", () => {
    expect(hasFullConsent(new URLSearchParams("terms=1"))).toBe(false);
    expect(hasFullConsent(new URLSearchParams("privacy=1&terms=0"))).toBe(false);
    expect(hasFullConsent(new URLSearchParams("consent=1"))).toBe(false);
    expect(hasFullConsent(new URLSearchParams(""))).toBe(false);
  });
});
