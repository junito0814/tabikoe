import { describe, expect, it } from "vitest";
import { spotIdsWithAllFindings } from "./visit-findings";

/**
 * 出典: 要件定義書 4.5.19「絞り込み」／ Issue #929（c）
 *
 * 絞り込みの肝は **AND**（選んだものがすべてそろっている）。
 * ここが OR になると「ペットだけ OK の店」が「ペット＋駐車場」で出てしまう。
 */
const row = (spotId: string, finding: string) => ({ spotId, finding });

describe("spotIdsWithAllFindings（#929 絞り込みの判定）", () => {
  it("選んだものが全部そろっているスポットだけ残る（AND）", () => {
    const rows = [row("a", "pet"), row("a", "parking"), row("b", "pet"), row("c", "parking")];
    expect([...spotIdsWithAllFindings(rows, ["pet", "parking"])]).toEqual(["a"]);
  });

  it("1 つだけ選んだときは、それを持つスポットが全部残る", () => {
    const rows = [row("a", "pet"), row("b", "pet"), row("c", "parking")];
    expect([...spotIdsWithAllFindings(rows, ["pet"])].sort()).toEqual(["a", "b"]);
  });

  it("報告が 1 つも無いスポットは出てこない（空欄を「当てはまる」とは読まない）", () => {
    expect([...spotIdsWithAllFindings([row("a", "pet")], ["parking"])]).toEqual([]);
  });

  it("知らない項目は数えない（DB に CHECK を置いていないため）", () => {
    const rows = [row("a", "pet"), row("a", "wifi")];
    expect([...spotIdsWithAllFindings(rows, ["pet"])]).toEqual(["a"]);
    // 同じ行があっても「wifi」は項目として存在しないので、a は "pet" しか持たない扱い
    expect([...spotIdsWithAllFindings(rows, ["pet", "parking"])]).toEqual([]);
  });

  it("条件が空なら、そもそも絞らない（呼ぶ側が null を使うので、ここは空集合でよい）", () => {
    expect([...spotIdsWithAllFindings([row("a", "pet")], [])].sort()).toEqual(["a"]);
  });
});
