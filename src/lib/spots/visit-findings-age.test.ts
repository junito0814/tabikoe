import { describe, expect, it } from "vitest";
import { visitFindingAge } from "./visit-findings-age";

const now = new Date("2026-10-17T00:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

describe("visitFindingAge", () => {
  it("1 か月たっていなければ「今月」", () => {
    expect(visitFindingAge(daysAgo(0), now)).toBe("今月");
    expect(visitFindingAge(daysAgo(30), now)).toBe("今月");
  });

  it("1 か月ほど前は「先月」", () => {
    expect(visitFindingAge(daysAgo(40), now)).toBe("先月");
  });

  it("数か月前は「N か月前」", () => {
    expect(visitFindingAge(daysAgo(100), now)).toBe("3 か月前");
    expect(visitFindingAge(daysAgo(300), now)).toBe("9 か月前");
  });

  it("1 年を超えたら「1 年以上前」（何年前かは出さない）", () => {
    expect(visitFindingAge(daysAgo(400), now)).toBe("1 年以上前");
    expect(visitFindingAge(daysAgo(2000), now)).toBe("1 年以上前");
  });

  // 端末の時計がずれていても、未来の日付で変な文字が出ないようにする
  it("未来の日付は「今月」として扱う", () => {
    expect(visitFindingAge(daysAgo(-5), now)).toBe("今月");
  });
});
