/**
 * 出典: docs/tasks/posts/post-entry-points/01-compose-initial-state.md（単体テスト）
 * 「7 通りの入口ごとに地図の初期位置・スポット・旅行・日付が表のとおりになること」
 */
import { describe, expect, it } from "vitest";
import { buildComposeInitialState, composeHref } from "./compose-initial-state";
import { todayInJst } from "./constants";

const spot = { id: "s1", name: "たこ焼き〇〇", lat: 34.7, lng: 135.5, prefecture: "大阪府", source: "places" as const };

describe("buildComposeInitialState", () => {
  it("何も無ければ現在地（画面側で取得）、日付は今日", () => {
    const state = buildComposeInitialState({});
    expect(state).toMatchObject({ source: "current", center: null, centerFromCurrentLocation: true, spot: null, visitDate: todayInJst() });
  });
  it("いまいる場所に投稿する（from=current）は現在地由来", () => {
    const state = buildComposeInitialState({ lat: "35.6", lng: "139.7", from: "current" });
    expect(state).toMatchObject({ source: "location", center: { lat: 35.6, lng: 139.7 }, centerFromCurrentLocation: true });
  });
  it("長押しの点は現在地由来ではない", () => {
    const state = buildComposeInitialState({ lat: "35.6", lng: "139.7" });
    expect(state.centerFromCurrentLocation).toBe(false);
  });
  it("既存ピン・自分も投稿する（spot=）はそのスポットに固定", () => {
    const state = buildComposeInitialState({ spot: "s1" }, { spot });
    expect(state).toMatchObject({ source: "spot", spot, center: { lat: 34.7, lng: 135.5 }, centerFromCurrentLocation: false });
  });
  it("しおりからは旅行タイトルと Day の日付が入る（未来日なら今日）", () => {
    const past = buildComposeInitialState({ itinerary: "i1", spot: "s1", day: "2" }, { spot, itinerary: { id: "i1", tripTitle: "大阪旅行", dayDate: "2020-09-21" } });
    expect(past).toMatchObject({ source: "itinerary", tripTitle: "大阪旅行", visitDate: "2020-09-21", itineraryId: "i1", spot });
    const future = buildComposeInitialState({ itinerary: "i1", spot: "s1" }, { spot, itinerary: { id: "i1", tripTitle: "大阪旅行", dayDate: "2999-01-01" } });
    expect(future.visitDate).toBe(todayInJst());
    const undecided = buildComposeInitialState({ itinerary: "i1", spot: "s1" }, { spot, itinerary: { id: "i1", tripTitle: "大阪旅行", dayDate: null } });
    expect(undecided.visitDate).toBe(todayInJst());
  });
  it("下書きの続きは draftId を持つ", () => {
    expect(buildComposeInitialState({ draft: "d1" })).toMatchObject({ source: "draft", draftId: "d1" });
  });
  it("範囲外の座標は無視して現在地扱い", () => {
    expect(buildComposeInitialState({ lat: "999", lng: "1" }).source).toBe("current");
  });
});

describe("composeHref", () => {
  it("入口ごとに正しいクエリを組む", () => {
    expect(composeHref({ kind: "current", lat: 1, lng: 2 })).toBe("/posts/new?lat=1&lng=2&from=current");
    expect(composeHref({ kind: "current" })).toBe("/posts/new?from=current");
    expect(composeHref({ kind: "location", lat: 1, lng: 2 })).toBe("/posts/new?lat=1&lng=2");
    expect(composeHref({ kind: "spot", spotId: "s1" })).toBe("/posts/new?spot=s1");
    expect(composeHref({ kind: "itinerary", itineraryId: "i1", spotId: "s1", dayIndex: 2 })).toBe("/posts/new?itinerary=i1&spot=s1&day=2");
    expect(composeHref({ kind: "draft", draftId: "d1" })).toBe("/posts/new?draft=d1");
  });
});
