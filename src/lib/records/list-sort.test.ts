import { describe, expect, it } from "vitest";
import { isAscending, listSortLabel, LIST_SORTS, parseListSort } from "./list-sort";

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
    // #863: 「何の」新しい順かが言葉に入る
    expect(listSortLabel("newest", "保存")).toBe("保存が新しい順");
    expect(listSortLabel("oldest", "保存")).toBe("保存が古い順");
    expect(listSortLabel("newest", "作成")).toBe("作成が新しい順");
    expect(listSortLabel("oldest", "作成")).toBe("作成が古い順");
  });
});
