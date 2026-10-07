import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { countLabel, TERMS } from "./terms";

/**
 * 出典: Issue #810「画面に出す言葉を統一する」／要件定義書 1.3・4.5.15
 */
describe("countLabel（#810）", () => {
  it("数字の前後に半角空白（「3 件」）", () => {
    expect(countLabel(3)).toBe("3 件");
  });

  it("4 桁以上は区切る", () => {
    expect(countLabel(1234)).toBe("1,234 件");
  });

  it("単位は変えられる（「3 人」）", () => {
    expect(countLabel(3, "人")).toBe("3 人");
  });
});

/**
 * 【初心者向け】同じ意味のことが画面ごとに違う言葉で書かれていると、読む人には**別のもの**に見えます。
 * 直したあと戻ってこないよう、ファイルを読んで機械的に確かめます（コメントは対象外）。
 */
describe("古い言葉が画面に残っていない（#810）", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) files.push(path);
    }
  };
  walk("src/components");
  walk("src/app");

  /** コメントを落としてから探す（なぜ変えたかの説明には古い言葉が出てよい） */
  const body = (path: string) =>
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  it.each([["ここを投稿"], ["自分も投稿する"], ["保存済み"], ["無効化"]])("「%s」が残っていない", (word) => {
    const offenders = files.filter((path) => body(path).includes(word));
    expect(offenders).toEqual([]);
  });

  it("件数は「N 件」（数字のすぐ後ろに「件」を書かない）", () => {
    const offenders = files.filter((path) => /[0-9}]件/.test(body(path)));
    expect(offenders).toEqual([]);
  });

  it("言葉は 1 か所（terms.ts）にある", () => {
    expect(TERMS.postHere).toContain("ここに投稿");
    expect(TERMS.seePosts).toBe("投稿を見る");
    expect(TERMS.wishlist).toBe("行きたい");
    expect(TERMS.revoke).toBe("取り消し");
    expect(TERMS.clearFilters).toBe("条件を消す");
  });
});
