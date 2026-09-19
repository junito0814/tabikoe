import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ALL_DAYS, buildItineraryPins, ItineraryMapOverlay } from "./ItineraryMapOverlay";
import type { ItineraryDetail, ItinerarySpotItem } from "@/lib/itineraries/get-itinerary";

/**
 * 出典: docs/tasks/itinerary/itinerary-map-and-post/01-itinerary-map.md 単体テスト
 * - Day 切替でピンが入れ替わること
 * - 済みが灰色（done）になること
 * - 「すべて」で色分け（dayIndex）になること
 */
const spot = (spotId: string, overrides: Partial<ItinerarySpotItem> = {}): ItinerarySpotItem => ({
  id: `is-${spotId}`,
  spotId,
  name: spotId,
  prefecture: null,
  lat: 34.7,
  lng: 135.5,
  isManualSpot: false,
  dayIndex: 1,
  arrivalTime: null,
  sortOrder: 0,
  memo: null,
  checkedAt: null,
  checkedBy: null,
  hasPosted: false,
  ratingAverage: null,
  costAverage: null,
  postCount: 0,
  ...overrides,
});

const itinerary: ItineraryDetail = {
  id: "it-1",
  tripId: "trip-1",
  title: "大阪旅行",
  startDate: "2026-09-20",
  endDate: "2026-09-21",
  dayCount: 2,
  dayDates: ["2026-09-20", "2026-09-21"],
  role: "owner",
  spots: [
    spot("a", { arrivalTime: "12:00", checkedAt: "2026-09-20T03:00:00Z" }),
    spot("b", { arrivalTime: "10:00" }),
    spot("c", { dayIndex: 2 }),
    spot("d", { dayIndex: null }),
  ],
  members: [],
  albumPostCount: 0,
  budgetEstimate: null,
  updatedAt: "2026-09-01T00:00:00Z",
};

describe("buildItineraryPins", () => {
  it("開いている Day のスポットだけに訪問順の番号ピン。済みは done", () => {
    const pins = buildItineraryPins(itinerary, 1);
    expect(pins.map((pin) => [pin.id, pin.label, pin.done])).toEqual([
      ["b", 1, false],
      ["a", 2, true],
    ]);
    expect(pins[0]).toMatchObject({ type: "numbered", dayIndex: 1 });
    expect(buildItineraryPins(itinerary, 2).map((pin) => pin.id)).toEqual(["c"]);
    expect(buildItineraryPins(itinerary, null).map((pin) => pin.id)).toEqual(["d"]);
  });

  it("「すべて」では全日を Day ごとの色（dayIndex）で", () => {
    const pins = buildItineraryPins(itinerary, ALL_DAYS);
    expect(pins.map((pin) => [pin.id, pin.dayIndex])).toEqual([
      ["b", 1],
      ["a", 1],
      ["c", 2],
      ["d", 0],
    ]);
  });
});

describe("ItineraryMapOverlay", () => {
  it("Day タブ＋日付なし＋すべて。押すと onChange", () => {
    const onChange = vi.fn();
    render(<ItineraryMapOverlay itinerary={itinerary} day={1} onChange={onChange} />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Day 1", "Day 2", "日付なし", "すべて"]);
    fireEvent.click(screen.getByRole("tab", { name: "すべて" }));
    expect(onChange).toHaveBeenCalledWith(ALL_DAYS);
    fireEvent.click(screen.getByRole("tab", { name: "日付なし" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
