import { describe, expect, it } from "vitest";
import { loadMapState, mapEntryFor, saveMapState, shouldRestoreMapState, type MapState } from "./map-state";

/**
 * 出典: docs/tasks/shared-ui/mentoring-7/07-map-state-restore.md 単体テスト
 * - 保存した状態が同じキー（入口）で復元され、別のキーでは復元されないこと
 * - 移動手段の復元
 */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  };
}

const explore: MapState = { entry: "explore", mode: "explore", center: { lat: 35.68, lng: 139.76 }, zoom: 15, travel: "bicycle" };

describe("map-state", () => {
  it("保存した中心・ズーム・移動手段がそのまま戻る。30 分を過ぎたら捨てる", () => {
    const storage = memoryStorage();
    saveMapState(explore, storage);
    expect(loadMapState(storage)).toEqual(explore);
    expect(loadMapState(storage, Date.now() + 31 * 60 * 1000)).toBeNull();
  });

  it("壊れた値・無い値は null", () => {
    const storage = memoryStorage();
    expect(loadMapState(storage)).toBeNull();
    storage.setItem("tabikoe:map-state", "{not json");
    expect(loadMapState(storage)).toBeNull();
    storage.setItem("tabikoe:map-state", JSON.stringify({ entry: "default", savedAt: Date.now() }));
    expect(loadMapState(storage)).toBeNull();
  });

  it("同じ入口に戻ってきたときと、素の /map で開いたときだけ復元する", () => {
    const spot: MapState = { entry: "spot:s1", mode: "spot", center: { lat: 1, lng: 2 }, zoom: 16 };
    expect(shouldRestoreMapState("spot:s1", spot)).toBe(true); // ブラウザの戻るで同じ ?spot= に戻った
    expect(shouldRestoreMapState("spot:s2", spot)).toBe(false); // 別のスポットの地図を新しく開いた
    expect(shouldRestoreMapState("default", explore)).toBe(true); // 「← 地図」で素の /map に戻った → 探すモードのまま
    expect(shouldRestoreMapState("explore", spot)).toBe(false); // ホームから探すモードを新しく開いた
    expect(shouldRestoreMapState("default", null)).toBe(false);
  });

  // map-restore Task1（2026-09-25）: 判定は「同じ入口か」だけ。探すモードは “開いたときの現在地”（openedAt）で見る。
  // 以前は「今の地図の中心」と比べていたため、カードを横にスライドして地図が動くと復元されなかった
  it("探すモードは開いたときの現在地で判定する（今の中心が動いていても復元する）", () => {
    const openedAt = { lat: 35.68, lng: 139.76 };
    // カードのスライドで中心が 3km 先へ動いた状態
    const moved: MapState = { ...explore, center: { lat: 35.71, lng: 139.76 }, openedAt, activeSpotId: "s9" };
    expect(shouldRestoreMapState("explore", moved, { lat: 35.681, lng: 139.761 })).toBe(true);
    // 別の街から開き直した（開いた場所から 500m 超）
    expect(shouldRestoreMapState("explore", moved, { lat: 35.7, lng: 139.8 })).toBe(false);
    // 現在地が取れないときは復元する（取り直しを待たない）
    expect(shouldRestoreMapState("explore", moved, null)).toBe(true);
    // 古い保存（openedAt が無い）も復元する
    expect(shouldRestoreMapState("explore", explore, { lat: 35.7, lng: 139.8 })).toBe(true);
  });

  it("選んでいたカードと開いた場所も保存して戻る", () => {
    const storage = memoryStorage();
    const state: MapState = { ...explore, openedAt: { lat: 35.68, lng: 139.76 }, activeSpotId: "s9" };
    saveMapState(state, storage);
    expect(loadMapState(storage)).toEqual(state);
    // 壊れた値は捨てる（他は生きる）
    storage.setItem("tabikoe:map-state", JSON.stringify({ ...state, openedAt: { lat: "x" }, activeSpotId: 5, savedAt: Date.now() }));
    expect(loadMapState(storage)).toEqual(explore);
  });

  it("入口の種類は開き方から決まる", () => {
    expect(mapEntryFor({ mode: "spot", focusSpotId: "s1", itineraryId: null })).toBe("spot:s1");
    expect(mapEntryFor({ mode: "itinerary", focusSpotId: null, itineraryId: "it" })).toBe("itinerary:it");
    expect(mapEntryFor({ mode: "explore", focusSpotId: null, itineraryId: null })).toBe("explore");
    expect(mapEntryFor({ mode: "default", focusSpotId: null, itineraryId: null })).toBe("default");
  });
});
