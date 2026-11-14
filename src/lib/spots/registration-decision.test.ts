import { describe, expect, it } from "vitest";
import type { NearbySpot } from "./nearby";
import { decideSpotRegistration } from "./registration-decision";

/**
 * 出典: #1062（Google の候補を選んでも、50m 以内にある別の店に置き換わる）単体テスト
 * 要件定義書 3.3.5「重複登録の防止」
 */
const ramen: NearbySpot = { id: "ramen", name: "ラーメン B", lat: 35.0, lng: 135.0, prefecture: "京都府", source: "places", distance_meters: 8 };
const izakaya: NearbySpot = { id: "izakaya", name: "居酒屋 A", lat: 35.0001, lng: 135.0, prefecture: "京都府", source: "places", distance_meters: 0 };
const manual: NearbySpot = { id: "manual", name: "名前のない場所", lat: 35.0, lng: 135.0, prefecture: "京都府", source: "manual", distance_meters: 12 };

describe("decideSpotRegistration", () => {
  it("同じ Place ID のスポットがあれば、それを使う（距離は問わない）", () => {
    expect(decideSpotRegistration({ placeId: "ChIJ-izakaya", samePlaceSpot: izakaya, nearby: [ramen] })).toEqual({
      kind: "existing",
      spot: izakaya,
      reason: "same_place_id",
    });
  });

  it("Place ID が違う店が 50m 以内にあっても、そちらに寄せず新しく作る（#1062 の不具合）", () => {
    expect(decideSpotRegistration({ placeId: "ChIJ-izakaya", samePlaceSpot: null, nearby: [ramen] })).toEqual({ kind: "create" });
  });

  it("近くが手動登録（Place ID なし）でも、Google の候補は寄せずに新しく作る", () => {
    expect(decideSpotRegistration({ placeId: "ChIJ-izakaya", samePlaceSpot: null, nearby: [manual] })).toEqual({ kind: "create" });
  });

  it("Place ID が無い（地図のピンだけ）なら、今までどおり 50m 以内の既存に寄せる（受入条件 37）", () => {
    expect(decideSpotRegistration({ placeId: null, samePlaceSpot: null, nearby: [ramen, manual] })).toEqual({
      kind: "existing",
      spot: ramen,
      reason: "nearby",
    });
  });

  it("Place ID が無く、近くにも無ければ新しく作る", () => {
    expect(decideSpotRegistration({ placeId: null, samePlaceSpot: null, nearby: [] })).toEqual({ kind: "create" });
  });

  it("Place ID が無いときは、同じ Place ID の結果が渡されても見ない", () => {
    expect(decideSpotRegistration({ placeId: null, samePlaceSpot: izakaya, nearby: [] })).toEqual({ kind: "create" });
  });
});
