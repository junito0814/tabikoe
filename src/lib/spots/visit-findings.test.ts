import { describe, expect, it } from "vitest";
import {
  isVisitFinding,
  normalizeVisitFindings,
  VISIT_FINDING_GROUPS,
  VISIT_FINDING_LABELS,
  VISIT_FINDINGS,
} from "./visit-findings";

describe("行ってわかったことの項目", () => {
  it("グループは 4 つ、項目は 11", () => {
    expect(VISIT_FINDING_GROUPS.map((group) => group.label)).toEqual(["入れた", "あった", "平気だった", "支払い"]);
    expect(VISIT_FINDINGS).toHaveLength(11);
  });

  // 要件 4.5.19: 画面はこの一覧から作るので、言葉が欠けていると空のチップが出る
  it("どの項目にも言葉がある", () => {
    for (const finding of VISIT_FINDINGS) {
      expect(VISIT_FINDING_LABELS[finding]).toBeTruthy();
    }
  });

  it("知らない値は項目として認めない", () => {
    expect(isVisitFinding("pet")).toBe(true);
    expect(isVisitFinding("wifi")).toBe(false);
    expect(isVisitFinding(null)).toBe(false);
  });

  describe("normalizeVisitFindings", () => {
    it("知らない値を落とす", () => {
      expect(normalizeVisitFindings(["pet", "wifi", 42])).toEqual(["pet"]);
    });

    it("重複を落とす", () => {
      expect(normalizeVisitFindings(["pet", "pet"])).toEqual(["pet"]);
    });

    it("並びはいつも同じ（グループの順）", () => {
      expect(normalizeVisitFindings(["card", "pet", "parking"])).toEqual(["pet", "parking", "card"]);
    });

    it("何も選ばなければ空", () => {
      expect(normalizeVisitFindings([])).toEqual([]);
    });
  });
});
