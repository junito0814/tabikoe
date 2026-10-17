import { describe, expect, it } from "vitest";
import { legacyMyMapTarget } from "./legacy-my-map-url";

/**
 * 出典: Issue #973（投稿履歴の URL とフォルダ名を /post-history にそろえる）
 *
 * 【初心者向け】古い URL を消さずに転送だけ残すのは、**すでに配られたリンクを切らない**ため
 * （ブックマーク、`sessionStorage` に残った戻り先）。ここでは「何を引き継ぐか」を押さえます。
 */
describe("legacyMyMapTarget（#973）", () => {
  it("クエリが無ければ /post-history へ", () => {
    expect(legacyMyMapTarget({})).toBe("/post-history");
  });

  it("地図タブ（?view=map）は引き継ぐ", () => {
    expect(legacyMyMapTarget({ view: "map" })).toBe("/post-history?view=map");
  });

  it("ピンの種類（?mode=）も引き継ぐ", () => {
    expect(legacyMyMapTarget({ mode: "saved" })).toBe("/post-history?mode=saved");
  });

  it("両方あれば両方", () => {
    expect(legacyMyMapTarget({ view: "map", mode: "posted" })).toBe("/post-history?view=map&mode=posted");
  });

  it("知らないクエリは落とす（新しい画面が解釈できるものだけ渡す）", () => {
    expect(legacyMyMapTarget({ view: "map", utm_source: "line", back: "/mypage" })).toBe("/post-history?view=map");
  });

  it("配列や空文字は無いものとして扱う", () => {
    expect(legacyMyMapTarget({ view: ["map", "list"], mode: "" })).toBe("/post-history");
  });
});
