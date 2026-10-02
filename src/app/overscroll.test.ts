import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * 出典: #639（ホーム・しおり・通知・マイページを横に引っぱると画面が動く）
 *       #592（ホームだけは上下にも動かさない）
 * 要件定義書 3.4.1
 *
 * 【初心者向け】`layout.tsx` をそのまま読み込むとフォント・メニューバー・Supabase まで
 * 引き込んでしまうので、**CSS の中身を読んで確かめる**（zoom-settings.test.ts と同じやり方）。
 * 指の操作そのものは機械で再現できないため、ここで見るのは「指定が消えていないか」。
 */
const css = readFileSync("src/app/globals.css", "utf8");

describe("#639: 横に引っぱっても動かさない", () => {
  it("overscroll-behavior-x: none が html と body に効いている", () => {
    expect(css).toMatch(/html,\s*\n\s*body\s*\{[\s\S]*?overscroll-behavior-x:\s*none/);
  });

  it("上下は全画面では止めていない（#628 の引っぱって更新で使う）", () => {
    // 上下を止めるのはホームだけ。`:has([data-home-fixed])` の付かない -y の指定は無いこと
    const blocks = [...css.matchAll(/([^{}]*)\{([^{}]*overscroll-behavior-y:\s*none[^{}]*)\}/g)];
    expect(blocks.length).toBeGreaterThan(0);
    for (const [, selector] of blocks) {
      expect(selector, "上下を止めるのはホームだけのはず").toContain("data-home-fixed");
    }
  });

  it("はみ出した中身を隠していない（#592 の決定どおり overflow は使わない）", () => {
    // 文字を大きくした端末などで万一はみ出したとき、読めなくなるのを避ける。
    // 横に並べてスクロールさせる箇所の `overflow-x: auto` は要素ごとなので、ここの対象外
    const pageLevel = [...css.matchAll(/(^|\n)\s*(html|body)[^{}]*\{([^{}]*)\}/g)];
    for (const [, , selector, body] of pageLevel) {
      expect(body, `${selector} で overflow を指定している`).not.toMatch(/overflow(-x|-y)?:\s*(hidden|clip)/);
    }
  });
});

describe("#592: ホームは上下にも動かさない", () => {
  it("ホームの上下を止める指定が残っている", () => {
    expect(css).toMatch(/html:has\(\[data-home-fixed\]\)[\s\S]*?overscroll-behavior-y:\s*none/);
  });

  it("ホームの画面に data-home-fixed が付いている", () => {
    // ホーム（SC-00）はログインの前後で別の部品になる
    for (const path of ["src/components/auth/AuthScreen.tsx", "src/components/search/SearchTopScreen.tsx"]) {
      expect(readFileSync(path, "utf8"), `${path} に data-home-fixed が無い`).toContain("data-home-fixed");
    }
  });
});
