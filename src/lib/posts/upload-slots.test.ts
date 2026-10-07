import { describe, expect, it } from "vitest";
import { isOwnTempPath, MAX_UPLOAD_SLOTS, tempUploadPath } from "./upload-slots";

/**
 * #860 の判断のテスト。
 *
 * 【初心者向け】署名付き URL を配ると、**ブラウザが Storage に直接書けます**。
 * だから「どこに書けるか」をサーバーが決め、受け取ったパスも**信じずに確かめ**ます。
 * ここを緩めると、他人のファイルを上書きできてしまいます。
 */
const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

describe("tempUploadPath", () => {
  it("必ず自分の ID の下の tmp に置く", () => {
    expect(tempUploadPath(ME, "abc")).toBe(`${ME}/tmp/abc`);
  });

  it("毎回ちがう名前になる（同じ投稿で 2 枚選んでもぶつからない）", () => {
    expect(tempUploadPath(ME)).not.toBe(tempUploadPath(ME));
  });
});

describe("isOwnTempPath", () => {
  it("自分の tmp の下だけを通す", () => {
    expect(isOwnTempPath(`${ME}/tmp/abc`, ME)).toBe(true);
  });

  it("他人の場所は通さない", () => {
    expect(isOwnTempPath(`${OTHER}/tmp/abc`, ME)).toBe(false);
  });

  it("tmp の外は通さない（出来上がった写真を上書きさせない）", () => {
    expect(isOwnTempPath(`${ME}/abc/resized.jpg`, ME)).toBe(false);
    expect(isOwnTempPath(`${ME}/tmp/abc/resized.jpg`, ME)).toBe(false);
  });

  it("上の階層へ登る書き方・先頭のスラッシュを通さない", () => {
    expect(isOwnTempPath(`${ME}/tmp/../${OTHER}/tmp/x`, ME)).toBe(false);
    expect(isOwnTempPath(`/${ME}/tmp/abc`, ME)).toBe(false);
  });

  it("空の名前を通さない", () => {
    expect(isOwnTempPath(`${ME}/tmp/`, ME)).toBe(false);
  });
});

describe("MAX_UPLOAD_SLOTS", () => {
  it("1 回に配る枚数に上限がある", () => {
    expect(MAX_UPLOAD_SLOTS).toBeGreaterThan(0);
    expect(MAX_UPLOAD_SLOTS).toBeLessThanOrEqual(50);
  });
});
