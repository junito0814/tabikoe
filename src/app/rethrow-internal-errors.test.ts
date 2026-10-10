import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

/**
 * #895（2026-10-09）: Next.js の内部的な合図を握りつぶさない。
 *
 * 【初心者向け】何が起きていたか。
 *   `cookies()` を使っている画面を Next.js が「静的に作れるか」試すとき、
 *   `DYNAMIC_SERVER_USAGE` という**合図を例外の形で**投げてくる。エラーではなく、
 *   「このページは毎回サーバーで描くものだ」と伝えるための仕組み。
 *
 *   それを `catch (error) { console.error(...) }` が拾って赤字で出していたため、
 *   **ビルドのたびにページ数ぶんの赤字**（2026-10-09 時点で 18 個）が並んでいた。
 *   ビルドは成功しているのに失敗に見えるので、**本物の失敗がその中に埋もれる**。
 *   実際、本番の再デプロイのときにこれを失敗と判断して調査に時間を使った。
 *
 *   同じ `catch` は `redirect()` と `notFound()` も飲み込む。飲み込むと**転送が黙って効かなくなる**。
 *   いまは該当する箇所が無いことを確かめてあるが、あとから `try` の中に `redirect()` を書くと
 *   気づかないまま壊れる。だから「拾う前に投げ直す」を決まりにして、ここで見張る。
 *
 * 置き場所について: vitest は `src/**` しか見ないので、ここに置いている。
 */
const SOURCES = globSync("src/app/**/*.{ts,tsx}").filter((path) => !path.endsWith(".test.ts") && !path.endsWith(".test.tsx"));

/**
 * コメントを外す。
 *
 * 【初心者向け】これが無いと、**説明文の中の「console.error」まで拾って**しまう。
 * 実際、直したばかりの layout.tsx が「直っていない」と判定された（コメントで経緯を書いたため）。
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** `catch (...) { ... }` の中身を取り出す（入れ子は見ないが、この用途には足りる） */
function catchBlocks(source: string): string[] {
  const blocks: string[] = [];
  for (const match of source.matchAll(/catch\s*\([^)]*\)\s*\{/g)) {
    let depth = 1;
    let i = match.index! + match[0].length;
    const start = i;
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") depth -= 1;
      i += 1;
    }
    blocks.push(source.slice(start, i));
  }
  return blocks;
}

describe("Next.js の内部的な合図を握りつぶさない（#895）", () => {
  it("見張る対象のファイルがある（読み取りに失敗していない）", () => {
    expect(SOURCES.length).toBeGreaterThan(50);
  });

  it("console.error に流す catch は、先に unstable_rethrow を通している", () => {
    const offenders: string[] = [];
    for (const path of SOURCES) {
      const source = withoutComments(readFileSync(path, "utf8"));
      for (const block of catchBlocks(source)) {
        if (!block.includes("console.error")) continue;
        const rethrowAt = block.indexOf("unstable_rethrow");
        const logAt = block.indexOf("console.error");
        // 投げ直しが無い、または記録のあとに書かれている（それでは遅い）
        if (rethrowAt === -1 || rethrowAt > logAt) offenders.push(path);
      }
    }
    expect(
      [...new Set(offenders)],
      "catch で console.error に流す前に unstable_rethrow(error) を呼ぶこと。" +
        "呼ばないと、ビルドログが Next.js の正常な合図で埋まり、redirect() も黙って効かなくなる"
    ).toEqual([]);
  });

  it("直した 3 か所が、公式の口（next/navigation）を使っている", () => {
    for (const path of ["src/app/layout.tsx", "src/app/admin/(shell)/layout.tsx", "src/app/admin/(shell)/page.tsx"]) {
      const source = readFileSync(path, "utf8");
      expect(source, `${path} が unstable_rethrow を import していない`).toMatch(/import \{[^}]*unstable_rethrow[^}]*\} from "next\/navigation"/);
    }
  });
});
