import { describe, expect, it } from "vitest";
import { postShareContent, shareClipboardText, spotShareContent } from "./share-text";

/**
 * 出典: Issue #953、要件定義書 4.5.18「共有する文面」
 *
 * **URL だけにしない。** リンクカード（OG）が出ない場所に送られても中身が伝わるように、
 * 題名と 1 行の説明を添える。題名は OG カードと同じ `〈スポット名〉｜タビコエ`。
 */
describe("spotShareContent（SC-04）", () => {
  it("題名・「行った人の投稿 N 件　★x.x」・URL の 3 つ", () => {
    expect(spotShareContent({ spotName: "浅草寺", postCount: 12, ratingAverage: 4.25, url: "/spots/s1" })).toEqual({
      title: "浅草寺｜タビコエ",
      text: "行った人の投稿 12 件　★4.3",
      url: "/spots/s1",
    });
  });

  it("評価がまだ無いスポットは件数だけ（★なしとは書かない）", () => {
    expect(spotShareContent({ spotName: "浅草寺", postCount: 1, ratingAverage: null, url: "/spots/s1" }).text).toBe("行った人の投稿 1 件");
  });
});

describe("postShareContent（SC-05）", () => {
  it("感想の冒頭 1 行を添える", () => {
    expect(postShareContent({ spotName: "浅草寺", comment: "桜がきれいだった\n次は夜に", url: "/posts/p1" })).toEqual({
      title: "浅草寺｜タビコエ",
      text: "桜がきれいだった",
      url: "/posts/p1",
    });
  });

  it("長い感想は切って、切った印を付ける", () => {
    const text = postShareContent({ spotName: "浅草寺", comment: "あ".repeat(200), url: "/posts/p1" }).text;
    expect(text).toHaveLength(91);
    expect(text.endsWith("…")).toBe(true);
  });

  it("感想が無くても空にしない", () => {
    expect(postShareContent({ spotName: "浅草寺", comment: null, url: "/posts/p1" }).text).toBe("行った人の投稿");
  });
});

describe("shareClipboardText", () => {
  it("共有シートが使えない環境でコピーする 1 つの文字列（改行でつなぐ）", () => {
    const content = spotShareContent({ spotName: "浅草寺", postCount: 2, ratingAverage: 5, url: "https://example.com/spots/s1" });
    expect(shareClipboardText(content)).toBe("浅草寺｜タビコエ\n行った人の投稿 2 件　★5.0\nhttps://example.com/spots/s1");
  });
});
