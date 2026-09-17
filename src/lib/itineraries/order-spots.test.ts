import { describe, expect, it } from "vitest";
import { isTenMinuteTime, orderSpots } from "./order-spots";

/**
 * 出典: docs/tasks/itinerary/arrival-time/01-spot-update-api-and-ordering.md 単体テスト
 * - 並び順関数（時刻あり／無し混在）
 * - 10 分刻み以外の拒否
 */
describe("orderSpots", () => {
  it("時刻ありは時刻順、無しは sort_order 順で末尾", () => {
    const spots = [
      { id: "d", arrivalTime: null, sortOrder: 1 },
      { id: "b", arrivalTime: "12:30", sortOrder: 0 },
      { id: "c", arrivalTime: null, sortOrder: 0 },
      { id: "a", arrivalTime: "10:00", sortOrder: 5 },
    ];
    expect(orderSpots(spots).map((spot) => spot.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("isTenMinuteTime", () => {
  it("10 分刻みだけ受け付ける", () => {
    expect(isTenMinuteTime("10:00")).toBe(true);
    expect(isTenMinuteTime("23:50")).toBe(true);
    expect(isTenMinuteTime("10:00:00")).toBe(true);
    expect(isTenMinuteTime("10:05")).toBe(false);
    expect(isTenMinuteTime("24:00")).toBe(false);
    expect(isTenMinuteTime("10:00:30")).toBe(false);
    expect(isTenMinuteTime(null)).toBe(false);
  });
});
