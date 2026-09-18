import { describe, expect, it } from "vitest";
import { resolveMapOpen, SPOT_FOCUS_ZOOM } from "./map-navigation";

/**
 * 出典: docs/tasks/map-search/map-display-v3/02-map-screen-rebuild.md 単体テスト
 * - クエリに応じた戻るボタンの文言と遷移先
 */
describe("resolveMapOpen", () => {
  it("?spot= はスポット中心で「一覧に戻る」（back の URL へ）", () => {
    const result = resolveMapOpen({ spot: "s1", lat: "34.7", lng: "135.5", back: "/search?pref=大阪府" });
    expect(result).toMatchObject({ mode: "spot", focusSpotId: "s1", center: { lat: 34.7, lng: 135.5 }, zoom: SPOT_FOCUS_ZOOM });
    expect(result.back).toEqual({ href: "/search?pref=大阪府", label: "一覧に戻る" });
  });

  it("back が外部 URL ならホームへ", () => {
    expect(resolveMapOpen({ spot: "s1", back: "https://evil.example" }).back).toEqual({ href: "/", label: "ホーム" });
  });

  it("?itinerary= は「しおりに戻る」", () => {
    expect(resolveMapOpen({ itinerary: "it-1" }).back).toEqual({ href: "/itineraries/it-1", label: "しおりに戻る" });
  });

  it("?mode=explore は探すモードで「ホーム」", () => {
    const result = resolveMapOpen({ mode: "explore", lat: "35.1", lng: "139.2" });
    expect(result.mode).toBe("explore");
    expect(result.center).toEqual({ lat: 35.1, lng: 139.2 });
    expect(result.back).toEqual({ href: "/", label: "ホーム" });
  });

  it("何も無ければ通常モード（中心は現在地に任せる）", () => {
    const result = resolveMapOpen({});
    expect(result.mode).toBe("default");
    expect(result.center).toBeNull();
    expect(result.back.label).toBe("ホーム");
  });
});
