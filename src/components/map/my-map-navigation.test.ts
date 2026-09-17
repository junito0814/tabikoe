import { describe, expect, it } from "vitest";
import { myMapPinHref } from "./my-map-navigation";

/**
 * 出典: docs/tasks/records/my-map/03-pin-tap-navigation.md 単体テスト
 * 出典: docs/tasks/records/my-map-v3/01-fetch-and-toggle.md 単体テスト
 * - ピン種別（投稿済み／保存済み／下書き）に応じて、生成される遷移先パスが正しく分岐することを検証する
 */
describe("myMapPinHref", () => {
  it("投稿済みピンは自分の投稿詳細（SC-05）へ", () => {
    expect(myMapPinHref({ kind: "posted", spotId: "s1", latestPostId: "p9" })).toBe("/posts/p9");
  });

  it("保存済みピンは投稿カード一覧（SC-04）へ", () => {
    expect(myMapPinHref({ kind: "saved", spotId: "s1", latestPostId: null })).toBe("/spots/s1");
  });

  it("下書きピンは「続きを書く」（SC-03）へ", () => {
    expect(myMapPinHref({ kind: "draft", spotId: null, latestPostId: "d1" })).toBe("/posts/new?draft=d1");
  });

  it("投稿IDが取れない投稿済みピンは一覧へ倒す", () => {
    expect(myMapPinHref({ kind: "posted", spotId: "s1", latestPostId: null })).toBe("/spots/s1");
  });
});
