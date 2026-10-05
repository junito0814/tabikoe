import { describe, expect, it } from "vitest";
import {
  ATTRIBUTION_SOURCE_LABELS,
  destinationSuggestionSource,
  groupBySource,
  spotCandidateSource,
} from "./attribution-source";

/**
 * 出典: #699（Google の候補一覧に「Google マップ」の表記が無い）単体テスト
 * 要件定義書 6.2
 */
describe("destinationSuggestionSource", () => {
  it("駅と市区町村は Google 由来（Places Autocomplete から来る）", () => {
    expect(destinationSuggestionSource("station")).toBe("google");
    expect(destinationSuggestionSource("locality")).toBe("google");
  });

  it("登録済みスポットと都道府県はタビコエ由来", () => {
    expect(destinationSuggestionSource("spot")).toBe("tabikoe");
    expect(destinationSuggestionSource("prefecture")).toBe("tabikoe");
  });
});

describe("spotCandidateSource", () => {
  it("id があるものは登録済み（タビコエ）", () => {
    expect(spotCandidateSource({ id: "spot-1" })).toBe("tabikoe");
  });

  it("id が無いものは Google 由来の未登録", () => {
    expect(spotCandidateSource({ id: null })).toBe("google");
  });
});

describe("groupBySource", () => {
  const src = (item: { s: "tabikoe" | "google" }) => item.s;

  it("タビコエが先、Google が後", () => {
    const groups = groupBySource([{ s: "google" as const }, { s: "tabikoe" as const }], src);
    expect(groups.map((group) => group.source)).toEqual(["tabikoe", "google"]);
  });

  it("組の中の並びは元のまま（API が返した順を崩さない）", () => {
    const items = [
      { s: "google" as const, name: "京都駅" },
      { s: "google" as const, name: "京都市中京区" },
    ];
    expect(groupBySource(items, src)[0]!.items.map((item) => item.name)).toEqual(["京都駅", "京都市中京区"]);
  });

  it("空の組は返さない（片方しか無いときに見出しだけ出さない）", () => {
    const groups = groupBySource([{ s: "tabikoe" as const }], src);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.source).toBe("tabikoe");
  });

  it("1 件も無ければ組も無い", () => {
    expect(groupBySource([], src)).toEqual([]);
  });
});

describe("見出しの文言", () => {
  it("Google の組の見出しそのものが「Google マップ」の表記になっている", () => {
    expect(ATTRIBUTION_SOURCE_LABELS.google).toContain("Google マップ");
    expect(ATTRIBUTION_SOURCE_LABELS.tabikoe).toBe("タビコエの中から");
  });
});
