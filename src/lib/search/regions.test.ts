import { describe, expect, it } from "vitest";
import { PREFECTURES } from "@/lib/geo/prefectures";
import { REGIONS, allRegionPrefectures, areaChips, normalizeAreas, regionState, removeAreaChip, togglePrefecture, toggleRegion, unknownRegionNames } from "./regions";

/**
 * #809（2026-10-06）: 絞り込みの「エリア」
 * 出典: 要件定義書 3.4.2、ワイヤーフレーム決定事項 83
 */
const KANTO = REGIONS.find((r) => r.name === "関東")!;
const TOHOKU = REGIONS.find((r) => r.name === "北海道・東北")!;

describe("地方と都道府県の対応", () => {
  it("47 都道府県が、どれか 1 つの地方にちょうど 1 回ずつ入っている", () => {
    const all = allRegionPrefectures();
    expect(all).toHaveLength(47);
    expect(new Set(all).size).toBe(47);
  });

  it("固定リスト（PREFECTURES）に無い名前が混ざっていない", () => {
    expect(unknownRegionNames()).toEqual([]);
    expect(new Set(allRegionPrefectures())).toEqual(new Set(PREFECTURES.map((p) => p.name)));
  });

  it("知らない名前は落とし、北から南の順にそろえる", () => {
    expect(normalizeAreas(["沖縄県", "ハワイ", "東京都", "東京都"])).toEqual(["東京都", "沖縄県"]);
  });
});

describe("地方の □ の形（全部／一部／未選択）", () => {
  it("1 つも選んでいなければ none", () => {
    expect(regionState(KANTO, [])).toBe("none");
  });
  it("一部だけなら some", () => {
    expect(regionState(KANTO, ["東京都", "神奈川県"])).toBe("some");
  });
  it("全部なら all", () => {
    expect(regionState(KANTO, [...KANTO.prefectures])).toBe("all");
  });
});

describe("地方のチェックを押したとき", () => {
  it("未選択 → その地方が全部入る", () => {
    expect(toggleRegion(KANTO, [])).toEqual([...KANTO.prefectures]);
  });

  it("一部だけ → 残りも入れる（押した人の意図は「残りも入れたい」）", () => {
    expect(toggleRegion(KANTO, ["東京都"])).toEqual([...KANTO.prefectures]);
  });

  it("全部 → その地方を全部外す。他の地方は残る", () => {
    const selected = [...TOHOKU.prefectures, ...KANTO.prefectures];
    expect(toggleRegion(KANTO, selected)).toEqual([...TOHOKU.prefectures]);
  });
});

describe("都道府県 1 つの出し入れ", () => {
  it("入っていなければ入れる、入っていれば外す", () => {
    expect(togglePrefecture("東京都", [])).toEqual(["東京都"]);
    expect(togglePrefecture("東京都", ["東京都", "大阪府"])).toEqual(["大阪府"]);
  });
});

describe("絞ったあとの札（areaChips）", () => {
  it("全部選んだ地方は 1 枚にまとめる", () => {
    expect(areaChips([...KANTO.prefectures])).toEqual([{ label: "関東", prefectures: [...KANTO.prefectures] }]);
  });

  it("一部だけの地方は都道府県ごとに出す", () => {
    expect(areaChips(["東京都", "神奈川県"])).toEqual([
      { label: "東京都", prefectures: ["東京都"] },
      { label: "神奈川県", prefectures: ["神奈川県"] },
    ]);
  });

  it("混ざっていれば、まとまった地方は 1 枚・残りは都道府県ごと", () => {
    const chips = areaChips([...TOHOKU.prefectures, "東京都", "神奈川県"]);
    expect(chips.map((c) => c.label)).toEqual(["北海道・東北", "東京都", "神奈川県"]);
  });

  it("2 地方を全部選んでも札は 2 枚（都道府県ごとだと 14 枚になるのを避ける）", () => {
    const chips = areaChips([...TOHOKU.prefectures, ...KANTO.prefectures]);
    expect(chips).toHaveLength(2);
  });

  it("何も選んでいなければ札は出ない", () => {
    expect(areaChips([])).toEqual([]);
  });
});

describe("札の × を押したとき", () => {
  it("地方の札なら、その地方の県が全部外れる", () => {
    const selected = [...TOHOKU.prefectures, "東京都"];
    const chip = areaChips(selected)[0];
    expect(chip.label).toBe("北海道・東北");
    expect(removeAreaChip(chip, selected)).toEqual(["東京都"]);
  });

  it("都道府県の札なら、その 1 つだけ外れる", () => {
    expect(removeAreaChip({ label: "東京都", prefectures: ["東京都"] }, ["東京都", "大阪府"])).toEqual(["大阪府"]);
  });
});
