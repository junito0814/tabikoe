import { describe, expect, it } from "vitest";
import { graphemeLength } from "./grapheme-length";

/**
 * 出典: docs/tasks/account/profile-edit/01-display-name-update-handler.md 単体テスト
 *       docs/tasks/posts/post-creation/02-post-form-ui.md 単体テスト
 * 「絵文字・結合文字が1文字としてカウントされること」（要件定義書3.3.1）
 */
describe("graphemeLength", () => {
  it("ASCIIは1文字ずつ数える", () => {
    expect(graphemeLength("abc")).toBe(3);
  });

  it("空文字は0", () => {
    expect(graphemeLength("")).toBe(0);
  });

  it("日本語も1文字ずつ数える", () => {
    expect(graphemeLength("沖縄旅行")).toBe(4);
  });

  it("単体の絵文字は1文字（コードユニット数ではない）", () => {
    // 😀 はUTF-16で2コードユニットだが、1書記素
    expect("😀".length).toBe(2);
    expect(graphemeLength("😀")).toBe(1);
  });

  it("ZWJで結合された絵文字は1文字", () => {
    // 👨‍👩‍👧 は複数のコードポイントをZWJで結合した1書記素
    const family = "👨‍👩‍👧";
    expect(family.length).toBeGreaterThan(1);
    expect(graphemeLength(family)).toBe(1);
  });

  it("肌色修飾子つき絵文字は1文字", () => {
    expect(graphemeLength("👍🏽")).toBe(1);
  });

  it("結合文字（濁点の分離表現）は基底文字と合わせて1文字", () => {
    // "が" を "か" + 結合濁点(U+3099) で表した場合
    const decomposed = "が";
    expect(decomposed.length).toBe(2);
    expect(graphemeLength(decomposed)).toBe(1);
  });

  it("絵文字と通常文字の混在を正しく数える", () => {
    expect(graphemeLength("沖縄😀旅行👨‍👩‍👧")).toBe(6);
  });
});
