import { describe, expect, it } from "vitest";
import { suggestedCategory } from "./suggested-category";

/** 出典: Issue #794 */
const base = { spotCategory: "観光スポット" as const, current: "", source: "spot" as const };

describe("suggestedCategory（#794）", () => {
  it("既存のスポット（投稿あり）で、まだ選んでいなければ出す", () => {
    expect(suggestedCategory(base)).toBe("観光スポット");
  });

  it("投稿の無いスポット・新しい場所では出さない（代表カテゴリが決まらない）", () => {
    expect(suggestedCategory({ ...base, spotCategory: null })).toBeNull();
  });

  it("すでに値が入っていれば出さない（邪魔になる）", () => {
    expect(suggestedCategory({ ...base, current: "グルメ" })).toBeNull();
  });

  it("下書きの続き・編集では出さない（書き直しの最中に横から勧めない）", () => {
    expect(suggestedCategory({ ...base, source: "draft" })).toBeNull();
    expect(suggestedCategory({ ...base, source: "edit" })).toBeNull();
  });

  it("しおり・現在地から開いたときも、スポットが決まっていれば出す", () => {
    expect(suggestedCategory({ ...base, source: "itinerary" })).toBe("観光スポット");
    expect(suggestedCategory({ ...base, source: "current" })).toBe("観光スポット");
  });
});
