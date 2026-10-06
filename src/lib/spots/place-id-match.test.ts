import { describe, expect, it } from "vitest";
import { MAX_DISTANCE_M, matchesSpot, metersBetween, normalizeName, withoutSeedMarker } from "./place-id-match";

/**
 * #755 の判断のテスト。
 * 「結び付けてよい／いけない」を間違えると他人の店の情報が出るので、境目を固めておく。
 */
const osakaCastle = { name: "大阪城", lat: 34.687315, lng: 135.526201 };

describe("metersBetween", () => {
  it("同じ点なら 0m", () => {
    expect(Math.round(metersBetween(osakaCastle, osakaCastle))).toBe(0);
  });

  it("大阪城と通天閣はおよそ 4km（実際の距離）", () => {
    const tsutenkaku = { lat: 34.652486, lng: 135.506264 };
    const m = metersBetween(osakaCastle, tsutenkaku);
    expect(m).toBeGreaterThan(3500);
    expect(m).toBeLessThan(4500);
  });

  it("緯度 0.001 度（約 111m）を正しく出す", () => {
    const m = metersBetween({ lat: 35, lng: 139 }, { lat: 35.001, lng: 139 });
    expect(Math.round(m)).toBe(111);
  });
});

describe("withoutSeedMarker", () => {
  it("全角・半角・角かっこの seed 印を外す", () => {
    expect(withoutSeedMarker("横浜 赤レンガ倉庫（seed）")).toBe("横浜 赤レンガ倉庫");
    expect(withoutSeedMarker("横浜 赤レンガ倉庫(seed)")).toBe("横浜 赤レンガ倉庫");
    expect(withoutSeedMarker("横浜 赤レンガ倉庫[seed]")).toBe("横浜 赤レンガ倉庫");
    expect(withoutSeedMarker("横浜 赤レンガ倉庫 [SEED]")).toBe("横浜 赤レンガ倉庫");
  });

  it("印が無い名前はそのまま", () => {
    expect(withoutSeedMarker("大阪城")).toBe("大阪城");
  });

  it("seed を含むだけの普通の名前は削らない", () => {
    expect(withoutSeedMarker("Seedless Cafe")).toBe("Seedless Cafe");
  });
});

describe("normalizeName", () => {
  it("空白・中黒・かっこを落として比べられる形にする", () => {
    expect(normalizeName("東京駅 丸の内駅舎（seed）")).toBe("東京駅丸の内駅舎");
    expect(normalizeName("ユニバーサル・スタジオ・ジャパン")).toBe("ユニバーサルスタジオジャパン");
  });
});

describe("matchesSpot", () => {
  it("名前も座標も合っていれば結び付ける", () => {
    const result = matchesSpot(osakaCastle, { name: "大阪城", lat: 34.687315, lng: 135.526201 });
    expect(result).toEqual({ ok: true, distanceM: 0 });
  });

  it("空白の有無だけの違いは同じ名前とみなす", () => {
    const result = matchesSpot(
      { name: "東京駅 丸の内駅舎（seed）", lat: 35.6812, lng: 139.7671 },
      { name: "東京駅丸の内駅舎", lat: 35.6812, lng: 139.7671 },
    );
    expect(result.ok).toBe(true);
  });

  it("名前が少しでも長ければ結び付けない（「◯号館」も別物として扱う）", () => {
    const result = matchesSpot(
      { name: "横浜 赤レンガ倉庫", lat: 35.4529, lng: 139.6428 },
      { name: "横浜赤レンガ倉庫1号館", lat: 35.4521, lng: 139.6434 },
    );
    expect(result.ok).toBe(false);
  });

  it("名前が合っていても遠ければ結び付けない（同名の別店舗を拾うため）", () => {
    const result = matchesSpot(osakaCastle, { name: "大阪城", lat: 34.72, lng: 135.526201 });
    expect(result).toEqual({ ok: false, reason: expect.stringContaining("離れている") });
  });

  it("すぐ隣（0m）でも、名前に自分の名前を含むだけの別の店は結び付けない", () => {
    // ここが「含んでいればよい」だと通ってしまい、コンビニの営業時間が大阪城に出る
    const result = matchesSpot(osakaCastle, { name: "大阪城公園駅前のコンビニ", lat: 34.687315, lng: 135.526201 });
    expect(result).toEqual({ ok: false, reason: "名前が違う（大阪城公園駅前のコンビニ）" });
  });

  it("座標が数でなければ結び付けない", () => {
    const result = matchesSpot(osakaCastle, { name: "大阪城", lat: Number.NaN, lng: 135.526201 });
    expect(result).toEqual({ ok: false, reason: "座標が取れない" });
  });

  it(`境目: ${MAX_DISTANCE_M}m までは通し、超えたら落とす`, () => {
    // 緯度 1 度 ≒ 111.19km。500m ちょうど手前と、少し超えたところを作る
    const degreesPerMeter = 1 / 111195;
    const inside = { name: "大阪城", lat: osakaCastle.lat + degreesPerMeter * (MAX_DISTANCE_M - 10), lng: osakaCastle.lng };
    const outside = { name: "大阪城", lat: osakaCastle.lat + degreesPerMeter * (MAX_DISTANCE_M + 10), lng: osakaCastle.lng };
    expect(matchesSpot(osakaCastle, inside).ok).toBe(true);
    expect(matchesSpot(osakaCastle, outside).ok).toBe(false);
  });
});
