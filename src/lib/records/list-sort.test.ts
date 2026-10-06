import { describe, expect, it } from "vitest";
import { isAscending, LIST_SORT_LABELS, LIST_SORTS, parseListSort } from "./list-sort";

/** 出典: Issue #797 */
describe("parseListSort（#797）", () => {
  it("oldest は古い順", () => {
    expect(parseListSort("oldest")).toBe("oldest");
  });

  it("newest は新着順", () => {
    expect(parseListSort("newest")).toBe("newest");
  });

  it("無い・空・知らない値はすべて新着順（既定）", () => {
    expect(parseListSort(null)).toBe("newest");
    expect(parseListSort(undefined)).toBe("newest");
    expect(parseListSort("")).toBe("newest");
    expect(parseListSort("rating")).toBe("newest");
  });
});

describe("isAscending（#797）", () => {
  it("古い順は昇順（古いものが先）", () => {
    expect(isAscending("oldest")).toBe(true);
  });

  it("新着順は降順（新しいものが先）", () => {
    expect(isAscending("newest")).toBe(false);
  });
});

describe("選択肢と文字", () => {
  it("2 つだけ。文字は「新着順」「古い順」", () => {
    expect(LIST_SORTS).toEqual(["newest", "oldest"]);
    expect(LIST_SORT_LABELS.newest).toBe("新着順");
    expect(LIST_SORT_LABELS.oldest).toBe("古い順");
  });
});
