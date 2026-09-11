import { describe, expect, it } from "vitest";
import { getClientIp, UNKNOWN_CLIENT_IP } from "./client-ip";

/**
 * 出典: docs/tasks/account/signup-login/08-login-rate-limiting.md 単体テスト
 * 「異なるIPアドレスからの試行は互いに影響しないこと」の前提として、
 * リクエストからIPを正しく取り出せることを担保する。
 */
function requestWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/auth/callback", { headers });
}

describe("getClientIp", () => {
  it("x-forwarded-for の先頭（クライアントに最も近いIP）を返す", () => {
    const request = requestWith({ "x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2" });
    expect(getClientIp(request)).toBe("203.0.113.5");
  });

  it("前後の空白を除去する", () => {
    const request = requestWith({ "x-forwarded-for": "  203.0.113.5 , 10.0.0.1" });
    expect(getClientIp(request)).toBe("203.0.113.5");
  });

  it("x-vercel-forwarded-for を x-forwarded-for より優先する", () => {
    const request = requestWith({
      "x-vercel-forwarded-for": "198.51.100.7",
      "x-forwarded-for": "203.0.113.5",
    });
    expect(getClientIp(request)).toBe("198.51.100.7");
  });

  it("x-forwarded-for が無ければ x-real-ip を使う", () => {
    const request = requestWith({ "x-real-ip": "192.0.2.9" });
    expect(getClientIp(request)).toBe("192.0.2.9");
  });

  it("どのヘッダーも無ければ共通のsubjectを返す（フェイルクローズ）", () => {
    expect(getClientIp(requestWith({}))).toBe(UNKNOWN_CLIENT_IP);
  });

  it("ヘッダーが空文字ならフォールバックへ進む", () => {
    const request = requestWith({ "x-forwarded-for": "", "x-real-ip": "192.0.2.9" });
    expect(getClientIp(request)).toBe("192.0.2.9");
  });
});
