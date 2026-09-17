import { describe, expect, it } from "vitest";
import { composeHref } from "./compose-href";

/**
 * 出典: docs/tasks/posts/post-entry-points/02-entry-links.md 単体テスト
 * - compose-href が入口ごとに正しいクエリを組むこと
 */
describe("composeHref", () => {
  it("入口ごとのクエリ", () => {
    expect(composeHref({ kind: "current", lat: 35.1, lng: 139.2 })).toBe("/posts/new?lat=35.1&lng=139.2&from=current");
    expect(composeHref({ kind: "current" })).toBe("/posts/new?from=current");
    expect(composeHref({ kind: "location", lat: 35, lng: 139 })).toBe("/posts/new?lat=35&lng=139");
    expect(composeHref({ kind: "spot", spotId: "s1" })).toBe("/posts/new?spot=s1");
    expect(composeHref({ kind: "itinerary", itineraryId: "it1", spotId: "s1", dayIndex: 2 })).toBe("/posts/new?itinerary=it1&spot=s1&day=2");
    expect(composeHref({ kind: "itinerary", itineraryId: "it1", spotId: "s1", dayIndex: null })).toBe("/posts/new?itinerary=it1&spot=s1");
    expect(composeHref({ kind: "draft", draftId: "d1" })).toBe("/posts/new?draft=d1");
  });
});
