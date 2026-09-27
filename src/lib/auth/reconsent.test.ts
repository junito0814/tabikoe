import { describe, expect, it } from "vitest";
import { cookieCoversPublished, encodeConsentCookie, missingConsents, needsReconsent, reconsentAction } from "./reconsent";

/** 出典: docs/tasks/admin/legal-documents/03-reconsent.md 単体テスト */
describe("needsReconsent", () => {
  const published = { terms: "1.2", privacy: "1.0" };

  it("未同意の種類があれば真、全部同意済みなら偽", () => {
    expect(needsReconsent(published, [{ kind: "terms", version: "1.2" }, { kind: "privacy", version: "1.0" }])).toBe(false);
    expect(needsReconsent(published, [{ kind: "terms", version: "1.1" }, { kind: "privacy", version: "1.0" }])).toBe(true);
    expect(missingConsents(published, [{ kind: "privacy", version: "1.0" }])).toEqual(["terms"]);
    expect(needsReconsent({}, [])).toBe(false);
  });

  it("Cookie は種類の順を固定した文字列で、公開中の版と一致すれば DB を見ない", () => {
    expect(encodeConsentCookie({ privacy: "1.0", terms: "1.2" })).toBe("privacy:1.0|terms:1.2");
    expect(cookieCoversPublished("privacy:1.0|terms:1.2", published)).toBe(true);
    expect(cookieCoversPublished("privacy:1.0|terms:1.1", published)).toBe(false);
    expect(cookieCoversPublished(undefined, published)).toBe(false);
    expect(cookieCoversPublished(undefined, {})).toBe(true);
  });

  it("再同意が要る人は同意画面・規約・認証 API だけ通り、他の画面は同意画面へ（元の場所つき）、他の API は 401", () => {
    for (const path of ["/consent/renew", "/terms", "/privacy", "/login", "/api/auth/logout", "/api/legal/terms"]) {
      expect(reconsentAction(path)).toEqual({ kind: "pass" });
    }
    expect(reconsentAction("/mypage")).toEqual({ kind: "redirect", to: "/consent/renew?redirect_to=%2Fmypage" });
    expect(reconsentAction("/search", "?pref=tokyo")).toEqual({ kind: "redirect", to: "/consent/renew?redirect_to=%2Fsearch%3Fpref%3Dtokyo" });
    expect(reconsentAction("/")).toEqual({ kind: "redirect", to: "/consent/renew" });
    expect(reconsentAction("/api/posts")).toEqual({ kind: "api_denied" });
  });
});
