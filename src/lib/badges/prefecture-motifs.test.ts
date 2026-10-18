import { describe, expect, it } from "vitest";
import { PREFECTURES } from "./catalog";
import {
  MOTIF_STROKE_WIDTH,
  motifFill,
  motifPrefectureNames,
  prefectureMotif,
  type MotifLayer,
} from "./prefecture-motifs";

/**
 * 出典: docs/tasks/badges/prefecture-motifs/01-motif-catalog.md 単体テスト
 * 要件定義書 4.5.20（描き方の決まり）、8 章 102
 *
 * 【初心者向け】絵そのものの良し悪しは**目で見るしかない**ので、ここでは
 * **目で見ても気づけないこと**を押さえます ── 県名の取り違え、絵の重複、線の数、
 * 枠からのはみ出し。どれも「画面では何となく出ているが実は間違っている」類のものです。
 */
const layers = (prefecture: string): readonly MotifLayer[] => {
  const motif = prefectureMotif(prefecture);
  expect(motif, `${prefecture} の絵が無い`).not.toBeNull();
  return motif!.layers;
};

/** 層の `d` に含まれる「M」の数 ＝ 線（小道）の本数 */
const strokeCount = (prefecture: string): number =>
  layers(prefecture).reduce((sum, layer) => sum + (layer.d.match(/M/g)?.length ?? 0), 0);

describe("47 県ぶんあること", () => {
  /*
   * **県名は `catalog.ts` の `PREFECTURES` と完全に一致していること。**
   *
   * 【初心者向け】ここがいちばん怖いところです。表記が 1 文字違うだけで
   * `prefectureMotif` は `null` を返し、画面は**黙って 🏅 に落ちます**。
   * 絵が出ないことには気づけますが、「どの県が」までは一覧を数えないと分かりません。
   */
  it("catalog.ts の 47 県すべてに絵がある", () => {
    const missing = PREFECTURES.filter((prefecture) => prefectureMotif(prefecture) === null);
    expect(missing).toEqual([]);
  });

  it("余分な県が混ざっていない（catalog.ts に無い名前を持っていない）", () => {
    const extra = motifPrefectureNames().filter((name) => !(PREFECTURES as readonly string[]).includes(name));
    expect(extra).toEqual([]);
  });

  it("並びは catalog.ts と同じ（北から）", () => {
    expect(motifPrefectureNames()).toEqual([...PREFECTURES]);
  });
});

describe("絵が区別できること", () => {
  it("同じ絵が 2 県に無い", () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const prefecture of PREFECTURES) {
      const key = layers(prefecture)
        .map((layer) => layer.d)
        .join("|");
      const first = seen.get(key);
      if (first) duplicates.push(`${first} と ${prefecture}`);
      else seen.set(key, prefecture);
    }
    expect(duplicates).toEqual([]);
  });
});

describe("描き方の決まり（要件 4.5.20）", () => {
  it("文字を使っていない（規則 4）", () => {
    for (const prefecture of PREFECTURES) {
      for (const layer of layers(prefecture)) {
        expect(layer.d, prefecture).not.toMatch(/text|tspan/i);
      }
    }
  });

  /*
   * 線の本数は 20 本まで。18〜20 本が 48px での境目で、
   * それを超えると（枝 2 段の雪の結晶で 30 本）六角形の塊に見えた。
   */
  it("線は 20 本まで", () => {
    const tooMany = PREFECTURES.filter((prefecture) => strokeCount(prefecture) > 20).map(
      (prefecture) => `${prefecture}（${strokeCount(prefecture)} 本）`
    );
    expect(tooMany).toEqual([]);
  });

  it("座標が壊れていない・枠からはみ出さない", () => {
    for (const prefecture of PREFECTURES) {
      for (const layer of layers(prefecture)) {
        const numbers = (layer.d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
        expect(numbers.length, prefecture).toBeGreaterThan(0);
        for (const value of numbers) {
          expect(Number.isNaN(value), `${prefecture}: NaN`).toBe(false);
          /*
           * `viewBox` の外（100 超）に出ていないこと。
           *
           * 【初心者向け】ここは「はみ出し」ではなく**座標が壊れていないこと**を見ています。
           * 曲線の制御点（`Q` の途中の点）は**描かれない点**なので、絵の実際の大きさより
           * 外に置かれることがあります（沖縄のたてがみは 95.3 まで出ますが、
           * 描かれる線は輪の内側に収まります）。だから実寸の上限では測れません。
           * 桁を間違えた・NaN が混ざった、といった壊れ方をここで止めます。
           */
          expect(Math.abs(value), `${prefecture}: ${value}`).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("どの層も、線か塗りのどちらかを持っている（何も描かない層が無い）", () => {
    for (const prefecture of PREFECTURES) {
      for (const layer of layers(prefecture)) {
        expect(layer.fill !== undefined || layer.stroke !== undefined, prefecture).toBe(true);
      }
    }
  });

  /*
   * 色数は要件 4.5.20 の表と合っていること。
   * 2026-10-17: ~~17 色~~ → **20 色**（実際に数えたら 20 色で、要件の表を直した）。
   * 増やすこと自体は構わないが、**気づかずに増えるのを止める**ためここで数える。
   */
  it("色は 20 色に収まっている", () => {
    const colors = new Set<string>();
    for (const prefecture of PREFECTURES) {
      const motif = prefectureMotif(prefecture)!;
      colors.add(motif.hue);
      for (const layer of motif.layers) {
        if (layer.fill) colors.add(layer.fill);
        if (layer.stroke) colors.add(layer.stroke);
      }
    }
    expect(colors.size).toBeLessThanOrEqual(20);
  });

  it("線の太さの既定は 7", () => {
    expect(MOTIF_STROKE_WIDTH).toBe(7);
  });
});

describe("prefectureMotif は知らない県名で null を返す（要件 8 章 102）", () => {
  it.each(["東京", "", "Tokyo", "北海道 ", "沖縄"])("%s → null", (name) => {
    expect(prefectureMotif(name)).toBeNull();
  });
});

describe("motifFill", () => {
  it("その色を 22% だけ使い、残りは透明にする", () => {
    expect(motifFill("#e05252")).toBe("color-mix(in srgb, #e05252 22%, transparent)");
  });
});
