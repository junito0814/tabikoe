import { describe, expect, it } from "vitest";
import { itineraryGroup, sortItineraries } from "./sort-itineraries";

/**
 * 出典: docs/tasks/itinerary/itinerary-basics/02-itinerary-list-screen.md 単体テスト
 * - 並び順（期間が近い順→未設定→過ぎたもの）
 */
describe("sortItineraries", () => {
  const today = "2026-09-18";
  it("これから（近い順）→ 未設定（更新順）→ 過ぎたもの（終了が新しい順）", () => {
    const items = [
      { id: "past-old", startDate: "2026-07-01", endDate: "2026-07-02", updatedAt: "2026-07-03T00:00:00Z" },
      { id: "undated-old", startDate: null, endDate: null, updatedAt: "2026-09-01T00:00:00Z" },
      { id: "far", startDate: "2026-12-01", endDate: "2026-12-03", updatedAt: "2026-09-10T00:00:00Z" },
      { id: "past-recent", startDate: "2026-09-10", endDate: "2026-09-12", updatedAt: "2026-09-13T00:00:00Z" },
      { id: "soon", startDate: "2026-09-20", endDate: "2026-09-22", updatedAt: "2026-09-01T00:00:00Z" },
      { id: "undated-new", startDate: null, endDate: null, updatedAt: "2026-09-17T00:00:00Z" },
      { id: "today", startDate: "2026-09-18", endDate: "2026-09-18", updatedAt: "2026-09-01T00:00:00Z" },
    ];
    expect(sortItineraries(items, today).map((item) => item.id)).toEqual([
      "today",
      "soon",
      "far",
      "undated-new",
      "undated-old",
      "past-recent",
      "past-old",
    ]);
    expect(itineraryGroup(items[0], today)).toBe("past");
  });
});
