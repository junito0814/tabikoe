import { describe, expect, it } from "vitest";
// スクリプト本体は node で直接動かすため scripts/ に .mjs で置いている。
// 判断だけを .lib.mjs に分けてあるので、ここから読み込んで確かめる（同じ判断を 2 か所に書かないため）。
import { formatFactorLine, isConfirmed, nothingToDeleteMessage, parseArgs } from "../../../scripts/admin-mfa-reset.lib.mjs";

/** 出典: docs/tasks/admin/admin-login/08-mfa-recovery.md 単体テスト */
describe("parseArgs", () => {
  it("メールアドレス 1 つなら受け取る（前後の空白は落とす）", () => {
    expect(parseArgs(["admin@example.com"])).toEqual({ ok: true, email: "admin@example.com" });
    expect(parseArgs([" admin@example.com "])).toEqual({ ok: true, email: "admin@example.com" });
  });

  it("引数が無ければ使い方を出して止まる", () => {
    expect(parseArgs([])).toEqual({ ok: false, message: "使い方: node scripts/admin-mfa-reset.mjs <メールアドレス>" });
    expect(parseArgs(undefined).ok).toBe(false);
  });

  it("引数が 2 つ以上なら止まる（別の人のを巻き込んで消さない）", () => {
    expect(parseArgs(["a@example.com", "b@example.com"]).ok).toBe(false);
  });

  it("メールアドレスの形でなければ止まる", () => {
    for (const value of ["admin", "admin@", "@example.com", "admin example.com", "admin@example"]) {
      expect(parseArgs([value]).ok).toBe(false);
    }
  });
});

describe("formatFactorLine", () => {
  it("見分けるための情報だけを出す", () => {
    const line = formatFactorLine({
      id: "factor-1",
      factor_type: "totp",
      friendly_name: "タビコエ管理",
      status: "verified",
      created_at: "2026-09-29T00:00:00.000Z",
    });
    expect(line).toContain("factor-1");
    expect(line).toContain("totp");
    expect(line).toContain("verified");
  });

  it("秘密が混ざっていても絶対に出さない（AGENTS.md 21）", () => {
    const line = formatFactorLine({
      id: "factor-1",
      factor_type: "totp",
      status: "verified",
      secret: "JBSWY3DPEHPK3PXP",
      uri: "otpauth://totp/x?secret=JBSWY3DPEHPK3PXP",
    });
    expect(line).not.toContain("JBSWY3DPEHPK3PXP");
    expect(line).not.toContain("otpauth");
    expect(line).not.toContain("secret");
  });

  it("値が欠けていても落ちない", () => {
    expect(() => formatFactorLine({})).not.toThrow();
    expect(() => formatFactorLine(null)).not.toThrow();
  });
});

describe("isConfirmed", () => {
  it("yes と打たれたときだけ進む", () => {
    expect(isConfirmed("yes")).toBe(true);
    expect(isConfirmed(" yes ")).toBe(true);
  });

  it("それ以外では進まない（打ち間違いで消さない）", () => {
    for (const value of ["y", "Y", "YES", "Yes", "はい", "", "no", null, undefined]) {
      expect(isConfirmed(value)).toBe(false);
    }
  });
});

describe("nothingToDeleteMessage", () => {
  it("消すものが無いことを、対象つきで伝える", () => {
    expect(nothingToDeleteMessage("admin@example.com")).toContain("admin@example.com");
  });
});
