import { describe, expect, it } from "vitest";
import { formatTravelMinutes, parseTravelMode, travelMinutes, TRAVEL_RADIUS_METERS } from "./travel-time";

/**
 * 出典: docs/tasks/shared-ui/feedback-0919/07-travel-mode.md 単体テスト
 * - 2,000m は 徒歩 25 分／自転車で約 8 分／車で約 4 分 になること
 */
describe("travel-time", () => {
  it("2,000m の目安は 徒歩 25 分／自転車 8 分／車 4 分", () => {
    expect(travelMinutes(2000, "walk")).toBe(25);
    expect(travelMinutes(2000, "bicycle")).toBe(8);
    expect(travelMinutes(2000, "car")).toBe(4);
    expect(travelMinutes(0, "car")).toBe(1);
  });

  it("文言と半径", () => {
    expect(formatTravelMinutes(6, "walk")).toBe("徒歩 6分");
    expect(formatTravelMinutes(8, "bicycle")).toBe("自転車で約 8分");
    expect(formatTravelMinutes(12, "car")).toBe("車で約 12分");
    expect(TRAVEL_RADIUS_METERS).toEqual({ walk: 1000, bicycle: 3000, car: 10000 });
  });

  it("不正な値は徒歩に倒す", () => {
    expect(parseTravelMode("car")).toBe("car");
    expect(parseTravelMode("train")).toBe("walk");
    expect(parseTravelMode(null)).toBe("walk");
  });
});
