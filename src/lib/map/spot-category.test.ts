import { describe, expect, it } from "vitest";
import { resolveSpotCategory } from "./spot-category";

/**
 * 出典: docs/tasks/shared-ui/pin-categories/02-spot-category-resolution.md 単体テスト
 * 要件定義書 4.5.3「スポットのカテゴリの決め方」
 */
const post = (category: string | null, createdAt: string) => ({ category, createdAt });

describe("resolveSpotCategory", () => {
  it("いちばん多いカテゴリを選ぶ", () => {
    const posts = [
      post("グルメ", "2026-09-01T00:00:00Z"),
      post("観光スポット", "2026-09-02T00:00:00Z"),
      post("グルメ", "2026-09-03T00:00:00Z"),
    ];
    expect(resolveSpotCategory(posts)).toBe("グルメ");
  });

  it("同数なら新しい方を選ぶ", () => {
    const posts = [post("グルメ", "2026-09-01T00:00:00Z"), post("宿泊施設", "2026-09-05T00:00:00Z")];
    expect(resolveSpotCategory(posts)).toBe("宿泊施設");
    // 並び順に依らず、日付で決まること
    expect(resolveSpotCategory([...posts].reverse())).toBe("宿泊施設");
  });

  it("数の多さが日付より優先される（古くても多い方が勝つ）", () => {
    const posts = [
      post("グルメ", "2026-01-01T00:00:00Z"),
      post("グルメ", "2026-01-02T00:00:00Z"),
      post("ショッピング", "2026-09-30T00:00:00Z"),
    ];
    expect(resolveSpotCategory(posts)).toBe("グルメ");
  });

  it("投稿が無ければ null（ピンは灰色になる）", () => {
    expect(resolveSpotCategory([])).toBeNull();
  });

  it("知らないカテゴリ・未設定は数に入れない", () => {
    expect(resolveSpotCategory([post(null, "2026-09-01T00:00:00Z"), post("存在しない分類", "2026-09-02T00:00:00Z")])).toBeNull();
    expect(resolveSpotCategory([post(null, "2026-09-01T00:00:00Z"), post("グルメ", "2026-09-02T00:00:00Z")])).toBe("グルメ");
  });

  it("日付が無くても落ちない", () => {
    expect(resolveSpotCategory([{ category: "グルメ", createdAt: null }])).toBe("グルメ");
  });
});
