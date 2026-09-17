import { describe, expect, it } from "vitest";
import { mergeMyMapPins, parseMyMapMode } from "./get-my-map-pins";

/**
 * 出典: docs/tasks/records/my-map/01-my-map-pin-data-handler.md 単体テスト
 * - 投稿と保存済みの両方に該当するスポットが、重複せず「投稿済み」種別で1件返ることを検証する
 * - 101件以上該当する場合に100件で打ち切られることを検証する
 * 出典: docs/tasks/records/my-map-v3/01-fetch-and-toggle.md 単体テスト
 * - posted＋saved が posted 1 件になること、切替に関わらず draft が含まれること
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
    expect(pins[1]).toMatchObject({ spotId: "only-wish", kind: "saved", latestPostId: null });
  });

  it("mode=posted は投稿済みのみ、mode=saved は保存済みのみ。下書きはどちらでも含む", () => {
    const posted = [{ spot: spot("a"), latestPostId: "p" }];
    const saved = [{ spot: spot("b") }];
    const drafts = [{ id: "d1", lat: 35, lng: 139, spot: null }];
    expect(mergeMyMapPins(posted, saved, "posted", drafts).map((pin) => pin.id)).toEqual(["a", "draft:d1"]);
    expect(mergeMyMapPins(posted, saved, "saved", drafts).map((pin) => pin.id)).toEqual(["b", "draft:d1"]);
    const draftPin = mergeMyMapPins([], [], "both", drafts)[0];
    expect(draftPin).toMatchObject({ kind: "draft", name: "名前のない場所", latestPostId: "d1", spotId: null });
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
    expect(parseMyMapMode("saved")).toBe("saved");
    // v1 の値は saved として読む
    expect(parseMyMapMode("wishlist")).toBe("saved");
  });
});
