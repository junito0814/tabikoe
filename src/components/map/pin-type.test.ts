import { describe, expect, it } from "vitest";
import { resolveMapPinType } from "./pin-type";

/**
 * 出典: docs/tasks/map-search/map-display/04-pin-type-integration.md 単体テスト
 * - 投稿済み＋「行きたい」保存済みのスポットについて、「全体」タブ上では normal 種別で描画されることを検証する
 */
describe("resolveMapPinType", () => {
  it("投稿済み＋行きたい保存済みのスポットは「全体」タブでは normal", () => {
    expect(resolveMapPinType("all", { hasOwnPost: true, isWishlisted: true })).toBe("normal");
  });

  it("「全体」タブは組み合わせに関わらず normal", () => {
    expect(resolveMapPinType("all", { hasOwnPost: false, isWishlisted: true })).toBe("normal");
    expect(resolveMapPinType("all", { hasOwnPost: true, isWishlisted: false })).toBe("normal");
    expect(resolveMapPinType("all", { hasOwnPost: false, isWishlisted: false })).toBe("normal");
  });

  it("「行きたい」タブは wishlist", () => {
    expect(resolveMapPinType("wishlist", { hasOwnPost: true, isWishlisted: true })).toBe("wishlist");
    expect(resolveMapPinType("wishlist", { hasOwnPost: false, isWishlisted: true })).toBe("wishlist");
  });
});
