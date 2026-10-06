/**
 * 出典: docs/tasks/map-search/search-top/03-submit-and-geocode.md（単体テスト）「種別ごとの遷移先 URL が正しいこと」
 */
import { describe, expect, it } from "vitest";
import { buildSearchHref } from "./build-search-href";

describe("buildSearchHref", () => {
  it("都道府県・スポット・座標で URL が変わる", () => {
    expect(buildSearchHref({ kind: "prefecture", name: "大阪府", lat: 1, lng: 2 })).toBe("/search?pref=%E5%A4%A7%E9%98%AA%E5%BA%9C");
    expect(buildSearchHref({ kind: "spot", name: "大阪城", spotId: "s1", prefecture: null })).toBe("/search?spot=s1");
    expect(buildSearchHref({ kind: "coords", lat: 34.7, lng: 135.5, q: "大阪駅" })).toBe("/search?lat=34.7&lng=135.5&q=%E5%A4%A7%E9%98%AA%E9%A7%85");
  });
  it("追加モードのクエリを引き継ぐ", () => {
    expect(buildSearchHref({ kind: "prefecture", name: "大阪府", lat: 1, lng: 2 }, { itinerary: "i1", day: "2" })).toBe("/search?pref=%E5%A4%A7%E9%98%AA%E5%BA%9C&itinerary=i1&day=2");
  });
});

/**
 * #756（2026-10-06）: ホームから来たことを伝える
 * 出典: Issue #756「Bug 2: ホームの検索からスポットを開くと、戻るが「地図」になる」
 */
describe("どこから来たか（#756）", () => {
  it("back を渡すと末尾に付く（スポット・都道府県・駅のどれでも）", () => {
    expect(buildSearchHref({ kind: "spot", name: "大阪城", spotId: "s1", prefecture: null }, null, "/")).toBe("/search?spot=s1&back=%2F");
    expect(buildSearchHref({ kind: "prefecture", name: "大阪府", lat: 1, lng: 2 }, null, "/")).toBe("/search?pref=%E5%A4%A7%E9%98%AA%E5%BA%9C&back=%2F");
    expect(buildSearchHref({ kind: "coords", lat: 34.7, lng: 135.5, q: "大阪駅" }, null, "/")).toBe("/search?lat=34.7&lng=135.5&q=%E5%A4%A7%E9%98%AA%E9%A7%85&back=%2F");
  });

  it("back が無ければ付かない（地図のピンから来たときは今までどおり既定の「地図」に倒れる）", () => {
    expect(buildSearchHref({ kind: "spot", name: "大阪城", spotId: "s1", prefecture: null })).toBe("/search?spot=s1");
  });

  it("しおりの追加モードと一緒でも両方付く", () => {
    expect(buildSearchHref({ kind: "spot", name: "大阪城", spotId: "s1", prefecture: null }, { itinerary: "i1", day: "2" }, "/")).toBe(
      "/search?spot=s1&itinerary=i1&day=2&back=%2F"
    );
  });
});
