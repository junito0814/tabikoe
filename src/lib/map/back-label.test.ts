import { describe, expect, it } from "vitest";
import { backLabelFor, classifyBackHref } from "./back-label";

/**
 * 出典: docs/tasks/shared-ui/mentoring-7/06-map-callout-and-back.md 単体テスト
 * - back の URL ごとの戻り先名（純粋関数）
 */
describe("classifyBackHref / backLabelFor", () => {
  const label = (back: string | null, spotName: string | null = null) => backLabelFor(classifyBackHref(back), spotName);

  it("都道府県・駅の検索結果はその名前", () => {
    expect(label("/search?pref=%E5%A4%A7%E9%98%AA%E5%BA%9C")).toBe("大阪府");
    expect(label("/search?q=%E5%A4%A7%E9%98%AA%E9%A7%85&lat=34.7&lng=135.5")).toBe("大阪駅");
  });

  it("スポット別・投稿詳細はスポット名（無ければ「一覧」）", () => {
    expect(classifyBackHref("/search?spot=s1")).toEqual({ kind: "spot", spotId: "s1" });
    expect(classifyBackHref("/spots/s1")).toEqual({ kind: "spot", spotId: "s1" });
    expect(classifyBackHref("/posts/p1")).toEqual({ kind: "post", postId: "p1" });
    expect(label("/spots/s1", "たこ焼き〇〇")).toBe("たこ焼き〇〇");
    expect(label("/posts/p1")).toBe("一覧");
  });

  it("しおりは「しおり」、無し・ホーム・壊れた URL は「ホーム」", () => {
    expect(label("/itineraries/it-1?day=2")).toBe("しおり");
    expect(label(null)).toBe("ホーム");
    expect(label("/")).toBe("ホーム");
    expect(label("http://[bad")).toBe("ホーム");
  });

  it("「一覧に戻る」という文言は使わない", () => {
    for (const back of ["/search?pref=x", "/search?q=y", "/spots/s1", "/posts/p1", "/itineraries/i", null]) {
      expect(label(back)).not.toContain("戻る");
    }
  });
});
