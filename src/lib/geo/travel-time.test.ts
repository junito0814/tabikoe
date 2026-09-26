import { describe, expect, it } from "vitest";
import { formatTravelMinutes, parseTravelMode, travelMinutes, TRAVEL_RADIUS_METERS, TRAVEL_SPEED_METERS_PER_MINUTE } from "./travel-time";

/**
 * 出典: docs/tasks/map-search/travel-time/01-routes-api-client.md 単体テスト
 *       要件定義書 3.4.6（半径と速度）・4.5.7（表示の言い方）
 * - 2026-09-25: 移動手段が 5 つに。徒歩 60m/分・自転車 180m/分。表示は「〈移動手段〉 約 N 分」で統一
 */
describe("travel-time", () => {
  it("直線距離からの計算: 2,000m は 徒歩 34 分／自転車 12 分（車・電車・バスは API が使えないときの値）", () => {
    expect(travelMinutes(2000, "walk")).toBe(34);
    expect(travelMinutes(2000, "bicycle")).toBe(12);
    expect(travelMinutes(2000, "car")).toBe(7);
    expect(travelMinutes(2000, "train")).toBe(5);
    expect(travelMinutes(2000, "bus")).toBe(10);
    expect(travelMinutes(0, "car")).toBe(1);
  });

  it("徒歩 60m/分は「道のりは直線の約 1.3 倍」を織り込んだ値（不動産広告の 80m/分 ÷ 1.3）", () => {
    expect(TRAVEL_SPEED_METERS_PER_MINUTE.walk).toBe(60);
    expect(TRAVEL_SPEED_METERS_PER_MINUTE.bicycle).toBe(180);
  });

  it("表示は「〈移動手段〉 約 N 分」で統一する", () => {
    expect(formatTravelMinutes(6, "walk")).toBe("徒歩 約 6分");
    expect(formatTravelMinutes(12, "bicycle")).toBe("自転車 約 12分");
    expect(formatTravelMinutes(12, "car")).toBe("車 約 12分");
    expect(formatTravelMinutes(24, "train")).toBe("電車 約 24分");
    expect(formatTravelMinutes(18, "bus")).toBe("バス 約 18分");
  });

  it("半径は 徒歩 1km／自転車 3km／車 10km／電車 15km／バス 8km（2026-09-26 にバスを拡大）", () => {
    expect(TRAVEL_RADIUS_METERS).toEqual({ walk: 1000, bicycle: 3000, car: 10000, train: 15000, bus: 8000 });
  });

  it("電車・バスも受け付け、知らない値は徒歩に倒す", () => {
    expect(parseTravelMode("car")).toBe("car");
    expect(parseTravelMode("train")).toBe("train");
    expect(parseTravelMode("bus")).toBe("bus");
    expect(parseTravelMode("plane")).toBe("walk");
    expect(parseTravelMode(null)).toBe("walk");
  });
});
