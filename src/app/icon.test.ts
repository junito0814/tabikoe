import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * 出典: docs/tasks/shared-ui/brand-logo/01-icon-and-favicon.md 単体テスト
 * - 要件定義書 4.5.9 の数値どおりのアイコンが置かれていること
 * - Next.js の初期状態の favicon.ico が残っていないこと
 *
 * 【初心者向け】ここでは画面ではなく「ファイルそのもの」を見ている。
 * アイコンは Next.js がファイルの置き場所だけを見て <head> に差し込むので、
 * 描画をテストする方法が無い。代わりに「正しい中身のファイルがそこにあるか」を確かめる。
 */
const appDir = join(process.cwd(), "src", "app");

describe("ロゴとファビコン（4.5.9）", () => {
  it("icon.svg があり、Next.js の初期状態の favicon.ico は無い", () => {
    expect(existsSync(join(appDir, "icon.svg"))).toBe(true);
    // favicon.ico が残っていると、ブラウザが /favicon.ico を先に読んで icon.svg が使われない
    expect(existsSync(join(appDir, "favicon.ico"))).toBe(false);
  });

  it("icon.svg が 4.5.9 の数値どおりである", () => {
    const svg = readFileSync(join(appDir, "icon.svg"), "utf8");
    expect(svg).toContain('fill="#2F7FD8"'); // 地の空の青
    expect(svg).toContain('r="11.5"'); // 吹き出しの円
    expect(svg).toContain('d="M32 42L36 51L40 42Z"'); // 下に伸びる尾
    expect(svg).toContain('r="22"'); // 内側の輪
    expect(svg).toContain('r="30"'); // 外側の輪
  });

  it("apple-icon.png が 180 × 180 である", () => {
    const png = readFileSync(join(appDir, "apple-icon.png"));
    // PNG の大きさは先頭の IHDR に入っている（16〜24 バイト目が幅と高さ）
    expect(png.readUInt32BE(16)).toBe(180);
    expect(png.readUInt32BE(20)).toBe(180);
  });
});
