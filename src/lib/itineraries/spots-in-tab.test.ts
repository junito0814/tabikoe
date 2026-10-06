import { describe, expect, it } from "vitest";
import { ALL_TAB } from "./day-tabs";
import { spotsInTab } from "./spots-in-tab";
import type { ItineraryDetail, ItinerarySpotItem } from "./get-itinerary";

/**
 * 出典: Issue #763「全画面の地図でピンをタップしたら、下にカードを出す」
 *
 * 【初心者向け】地図のピンと下のカードは 1 対 1 で対応していなければならないので、
 * 「どの Day を どの順で、何番として出すか」はこの関数 1 つに置いてある（約束 13・14）。
 */
const spot = (spotId: string, overrides: Partial<ItinerarySpotItem> = {}): ItinerarySpotItem =>
  ({
    id: `is-${spotId}`,
    spotId,
    name: `スポット${spotId}`,
    dayIndex: 1,
    arrivalTime: null,
    sortOrder: 0,
    checkedAt: null,
    ...overrides,
  }) as ItinerarySpotItem;

const itinerary = (spots: ItinerarySpotItem[], dayCount = 2): ItineraryDetail => ({ dayCount, spots }) as ItineraryDetail;

describe("spotsInTab（#763）", () => {
  it("Day を選んでいるときは、その Day だけを 1 番から数える", () => {
    const data = itinerary([spot("a"), spot("b", { sortOrder: 1 }), spot("c", { dayIndex: 2 })]);
    expect(spotsInTab(data, 1).map((item) => [item.spot.spotId, item.number])).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("ALL は「日付なし」が先頭（#759）。番号は Day ごとに 1 から数え直す", () => {
    const data = itinerary([spot("a"), spot("b", { dayIndex: 2 }), spot("z", { dayIndex: null })]);
    expect(spotsInTab(data, ALL_TAB).map((item) => [item.spot.spotId, item.day, item.number])).toEqual([
      ["z", null, 1],
      ["a", 1, 1],
      ["b", 2, 1],
    ]);
  });

  it("並びは時刻のある行が先（orderSpots と同じ）", () => {
    const data = itinerary([spot("a", { sortOrder: 0 }), spot("b", { sortOrder: 1, arrivalTime: "09:00" })]);
    expect(spotsInTab(data, 1).map((item) => item.spot.spotId)).toEqual(["b", "a"]);
  });

  it("スポットの無い Day は何も返さない", () => {
    expect(spotsInTab(itinerary([]), 1)).toEqual([]);
  });
});
