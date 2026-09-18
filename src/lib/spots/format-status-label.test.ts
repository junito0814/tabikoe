import { describe, expect, it } from "vitest";
import { formatStatusLabel, monthInJst } from "./format-status-label";

describe("formatStatusLabel", () => {
  it("still_there は「N月にまだあった」", () => {
    expect(formatStatusLabel({ status: "still_there", reportedAt: "2026-09-03T05:00:00Z" })).toBe("9月にまだあった");
  });

  it("gone は「N月に無くなっていたとの報告」", () => {
    expect(formatStatusLabel({ status: "gone", reportedAt: "2026-08-20T05:00:00Z" })).toBe("8月に無くなっていたとの報告");
  });

  it("月は JST で数える（UTC 8/31 23:00 は JST 9/1）", () => {
    expect(monthInJst("2026-08-31T23:00:00Z")).toBe(9);
    expect(formatStatusLabel({ status: "still_there", reportedAt: "2026-08-31T23:00:00Z" })).toBe("9月にまだあった");
  });

  it("報告が無い・日時が不正なら null", () => {
    expect(formatStatusLabel(null)).toBeNull();
    expect(formatStatusLabel({ status: "still_there", reportedAt: "bad" })).toBeNull();
  });
});
