import { describe, expect, it } from "vitest";
import { mergeMyMapPins, parseMyMapMode } from "./get-my-map-pins";

/**
 * 出典: docs/tasks/records/my-map/01-my-map-pin-data-handler.md 単体テスト
 * - 投稿と「行きたい」の両方に該当するスポットが、重複せず「投稿済み」種別で1件返ることを検証する
 * - 101件以上該当する場合に100件で打ち切られることを検証する
 */
const spot = (id: string) => ({ id, name: id, lat: 35, lng: 139 });

describe("mergeMyMapPins", () => {
  it("両方に該当するスポットは1件にまとまり、種別は posted（行きたい登録は保持）", () => {
    const pins = mergeMyMapPins(
      [{ spot: spot("both"), latestPostId: "p-latest" }, { spot: spot("both"), latestPostId: "p-older" }],
      [{ spot: spot("both") }, { spot: spot("only-wish") }],
      "both"
    );
    expect(pins).toHaveLength(2);
    expect(pins[0]).toMatchObject({ spotId: "both", kind: "posted", latestPostId: "p-latest", isWishlisted: true });
    expect(pins[1]).toMatchObject({ spotId: "only-wish", kind: "wishlist", latestPostId: null });
  });

  it("mode=posted は投稿済みのみ、mode=wishlist は行きたいのみ", () => {
    const posted = [{ spot: spot("a"), latestPostId: "p" }];
    const wish = [{ spot: spot("b") }];
    expect(mergeMyMapPins(posted, wish, "posted").map((pin) => pin.spotId)).toEqual(["a"]);
    expect(mergeMyMapPins(posted, wish, "wishlist").map((pin) => pin.spotId)).toEqual(["b"]);
  });

  it("101件以上は100件で打ち切る", () => {
    const posted = Array.from({ length: 70 }, (_, i) => ({ spot: spot(`p${i}`), latestPostId: `post${i}` }));
    const wish = Array.from({ length: 70 }, (_, i) => ({ spot: spot(`w${i}`) }));
    expect(mergeMyMapPins(posted, wish, "both")).toHaveLength(100);
  });
});

describe("parseMyMapMode", () => {
  it("既定は both", () => {
    expect(parseMyMapMode(null)).toBe("both");
    expect(parseMyMapMode("x")).toBe("both");
    expect(parseMyMapMode("posted")).toBe("posted");
    expect(parseMyMapMode("wishlist")).toBe("wishlist");
  });
});
