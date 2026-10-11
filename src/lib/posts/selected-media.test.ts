import { describe, expect, it } from "vitest";
import { existingMediaKey, newMediaKey, parseMediaKey, startIndexOf, toModalItems, trimEntryLabel } from "./selected-media";
import type { SelectedMedia } from "@/components/media/SelectedMediaThumbnails";

/**
 * #927: 投稿画面のサムネイルをタップしてモーダルで見る。
 *
 * 【初心者向け】ここで守りたいのは**番号のずれ**です。
 *   並びは「すでに付いている写真」＋「これから足すもの」なので、
 *   数え方を間違えると**隣の写真が開く**という、画面を見ても気づきにくい壊れ方をします。
 */
const items: SelectedMedia[] = [
  { key: existingMediaKey("p1"), url: "https://example.test/p1.jpg", mediaType: "photo", alt: "投稿済みの写真" },
  { key: newMediaKey(0), url: "blob:0", mediaType: "photo", alt: "IMG_0001.jpg" },
  { key: newMediaKey(1), url: "blob:1", mediaType: "video", alt: "IMG_0002.mp4" },
];

describe("鍵の読み書き", () => {
  it("書いた鍵をそのまま読める", () => {
    expect(parseMediaKey(newMediaKey(3))).toEqual({ kind: "new", index: 3 });
    expect(parseMediaKey(existingMediaKey("abc"))).toEqual({ kind: "existing", id: "abc" });
  });

  it("**壊れた鍵では 0 番目を指さない**（`new:` だけだと NaN になり、先頭を消してしまう）", () => {
    expect(parseMediaKey("new:")).toBeNull();
    expect(parseMediaKey("new:x")).toBeNull();
    expect(parseMediaKey("new:-1")).toBeNull();
    expect(parseMediaKey("existing:")).toBeNull();
    expect(parseMediaKey("photo-1")).toBeNull();
  });
});

describe("モーダルに渡す形", () => {
  it("すでに付いている写真と新しく選んだものを、1 つの並びのまま渡す（要件 4.5.1）", () => {
    expect(toModalItems(items).map((item) => item.id)).toEqual(["existing:p1", "new:0", "new:1"]);
  });

  it("動画は videoUrl にも入れる（モーダルは動画をそこから再生する）", () => {
    const [, photo, video] = toModalItems(items);
    expect(video.videoUrl).toBe("blob:1");
    expect(photo.videoUrl).toBeUndefined();
    expect(photo.fullUrl).toBe("blob:0");
  });
});

describe("何番目を開くか", () => {
  it("並びの中の位置を返す", () => {
    expect(startIndexOf(items, existingMediaKey("p1"))).toBe(0);
    expect(startIndexOf(items, newMediaKey(1))).toBe(2);
  });

  it("**外した直後は開かない**（無い鍵は null）", () => {
    expect(startIndexOf(items, newMediaKey(9))).toBeNull();
    expect(startIndexOf(items, null)).toBeNull();
  });
});

describe("「切り取る」の文", () => {
  it("いまの長さを添える（押す前に切る必要があるか分かるように）", () => {
    expect(trimEntryLabel(18)).toBe("切り取る（いまは 0:18）");
    expect(trimEntryLabel(95)).toBe("切り取る（いまは 1:35）");
  });

  it("長さが分からないときは数字を出さない（嘘の数字を出さない）", () => {
    expect(trimEntryLabel(null)).toBe("切り取る");
  });
});
