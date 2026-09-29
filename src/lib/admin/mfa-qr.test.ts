import { describe, expect, it } from "vitest";
import { formatTotpSecret, normalizeTotpCode, toQrImageSrc } from "./mfa-qr";

/** 出典: docs/tasks/admin/admin-login/05-mfa-screen.md 単体テスト */
describe("toQrImageSrc", () => {
  it("SVG の文字列は data URI に包む", () => {
    const src = toQrImageSrc('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(src?.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    // 「#」や「"」がそのまま入ると URI が途中で切れるため、必ずエスケープする
    expect(toQrImageSrc('<svg fill="#000"></svg>')).not.toContain('"');
    expect(toQrImageSrc('<svg fill="#000"></svg>')).not.toContain("#");
  });

  it("すでに data URI ならそのまま使う（SDK の版によってはこの形で返る）", () => {
    expect(toQrImageSrc("data:image/svg+xml;utf8,%3Csvg%3E")).toBe("data:image/svg+xml;utf8,%3Csvg%3E");
    expect(toQrImageSrc("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });

  it("前後に空白があっても読む", () => {
    expect(toQrImageSrc("  <svg></svg>  ")?.startsWith("data:image/svg+xml;utf8,")).toBe(true);
  });

  it("画像として使えない値は null（画面は手入力用の文字列だけ出す）", () => {
    expect(toQrImageSrc(null)).toBeNull();
    expect(toQrImageSrc(undefined)).toBeNull();
    expect(toQrImageSrc("")).toBeNull();
    expect(toQrImageSrc("   ")).toBeNull();
    expect(toQrImageSrc("otpauth://totp/x")).toBeNull();
    expect(toQrImageSrc("javascript:alert(1)")).toBeNull();
  });
});

describe("formatTotpSecret", () => {
  it("4 文字ずつ区切る", () => {
    expect(formatTotpSecret("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
    // 端数もそのまま出す
    expect(formatTotpSecret("ABCDE")).toBe("ABCD E");
    expect(formatTotpSecret("")).toBe("");
  });
});

describe("normalizeTotpCode", () => {
  it("数字 6 桁にそろえる", () => {
    expect(normalizeTotpCode("123456")).toBe("123456");
    expect(normalizeTotpCode(" 123 456 ")).toBe("123456");
    expect(normalizeTotpCode("123-456")).toBe("123456");
    // スマホのキーボードで全角が混ざることがある
    expect(normalizeTotpCode("１２３４５６")).toBe("123456");
  });

  it("6 桁でないもの・数字でないものは null", () => {
    expect(normalizeTotpCode("12345")).toBeNull();
    expect(normalizeTotpCode("1234567")).toBeNull();
    expect(normalizeTotpCode("12a456")).toBeNull();
    expect(normalizeTotpCode("")).toBeNull();
    expect(normalizeTotpCode(null)).toBeNull();
    expect(normalizeTotpCode(123456)).toBeNull();
  });
});
