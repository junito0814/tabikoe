import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * #766（2026-10-06）: 画面に出る言葉から「旅行」を無くす
 * 出典: Issue #766「Bug 6: 「すべての旅行」など「旅行」が残っている（用語は「アルバム」）」
 *       ワイヤーフレーム決定事項 25（用語の統一：「旅行タイトル」→「アルバム」）
 *
 * 【初心者向け】同じものを画面によって「旅行」と呼んだり「アルバム」と呼んだりすると、
 * 読む人には**別のもの**に見えます。コメント（読むのは作る人だけ）は対象外。
 */
describe("画面に出る言葉に「旅行」が無い（#766）", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) files.push(path);
    }
  };
  walk("src/components");
  walk("src/app");

  /** コメント（// と /* … *␣/）を落としてから探す */
  const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("「旅行」を含む文字列が無い（「例: 大阪旅行」のような**アルバム名の例**だけは残す）", () => {
    const offenders = files.flatMap((path) => {
      const body = withoutComments(readFileSync(path, "utf8"));
      const hits = [...body.matchAll(/[^\n]*旅行[^\n]*/g)].map((match) => match[0].trim());
      // 「例: 大阪旅行」はアルバム名の**例**（具体的な名前）なので、用語の揺れではない
      const real = hits.filter((line) => !line.includes("例: 大阪旅行"));
      return real.length > 0 ? [`${path}: ${real[0].slice(0, 60)}`] : [];
    });
    expect(offenders).toEqual([]);
  });
});
