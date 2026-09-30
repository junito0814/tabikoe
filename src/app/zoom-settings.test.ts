import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * 出典: docs/tasks/shared-ui/loading-feedback/06-zoom.md 単体テスト
 * 要件定義書 4.5.12（画面の拡大の扱い）
 *
 * 【初心者向け】`layout.tsx` をそのまま読み込むとフォント・メニューバー・Supabase まで
 * 引き込んでしまうので、**ファイルの中身を読んで確かめる**（admin-actions のマイグレーションと同じやり方）。
 */
const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

describe("4.5.12 の 1: 入力欄を 16px 以上にする", () => {
  it("入力欄の文字を 16px にする指定が globals.css にある", () => {
    expect(css).toMatch(/font-size:\s*16px/);
    expect(css).toContain("input:not([type=\"checkbox\"])");
    expect(css).toContain("textarea");
  });

  it("チェックボックス・ラジオ・ファイル選択は対象外（文字を持たない）", () => {
    for (const type of ["checkbox", "radio", "file"]) {
      expect(css).toContain(`:not([type="${type}"])`);
    }
  });

  it("わざと大きくしている入力欄を外す道がある（data-keep-size）", () => {
    expect(css).toContain(":not([data-keep-size])");
    // 管理者の 6 桁の入力欄は 24px のままにする
    for (const path of ["src/components/admin/AdminMfaScreen.tsx", "src/components/admin/StepUpDialog.tsx"]) {
      expect(readFileSync(path, "utf8")).toContain("data-keep-size");
    }
  });
});

describe("4.5.12 の 2: ダブルタップの拡大を止める", () => {
  it("touch-action: manipulation が body に効いている", () => {
    expect(css).toMatch(/body\s*\{[\s\S]*?touch-action:\s*manipulation/);
  });

  it("地図を名指しで上書きしていない（Google マップの操作を壊さないため）", () => {
    expect(css).not.toMatch(/aria-label="地図"[\s\S]*?touch-action/);
  });
});

describe("4.5.12 の 3: 指 2 本の拡大を止める", () => {
  it("viewport に maximumScale: 1 と userScalable: false がある", () => {
    expect(layout).toMatch(/maximumScale:\s*1/);
    expect(layout).toMatch(/userScalable:\s*false/);
  });

  it("帯の色の出し分け（ライト・ダーク）は残っている", () => {
    expect(layout).toContain("prefers-color-scheme: light");
    expect(layout).toContain("prefers-color-scheme: dark");
  });
});
