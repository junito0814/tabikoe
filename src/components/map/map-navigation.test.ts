import { describe, expect, it } from "vitest";
import { resolveMapOpen, SPOT_FOCUS_ZOOM } from "./map-navigation";
import { EMPTY_SPOT_FILTERS } from "@/lib/map/spot-aggregate";

/**
 * 出典: docs/tasks/map-search/map-display-v3/02-map-screen-rebuild.md 単体テスト
 * - クエリに応じた戻るボタンの文言と遷移先
 */
describe("resolveMapOpen", () => {
  it("?spot= はスポット中心で、戻るは戻り先の画面名（back の URL へ。v3.1）", () => {
    const result = resolveMapOpen({ spot: "s1", lat: "34.7", lng: "135.5", back: "/search?pref=大阪府" });
    expect(result).toMatchObject({ mode: "spot", focusSpotId: "s1", center: { lat: 34.7, lng: 135.5 }, zoom: SPOT_FOCUS_ZOOM });
    expect(result.back).toEqual({ href: "/search?pref=大阪府", label: "大阪府" });
  });

  it("v3.1: back がスポット別ならサーバーが引いたスポット名、無ければスポット別は「一覧」・投稿詳細は「投稿」（Bug #471）", () => {
    expect(resolveMapOpen({ spot: "s1", back: "/spots/s1", backSpotName: "たこ焼き〇〇" }).back.label).toBe("たこ焼き〇〇");
    expect(resolveMapOpen({ spot: "s1", back: "/posts/p1" }).back.label).toBe("投稿");
  });

  it("back が外部 URL ならホームへ", () => {
    expect(resolveMapOpen({ spot: "s1", back: "https://evil.example" }).back).toEqual({ href: "/", label: "ホーム" });
  });

  it("?itinerary= は「しおり」", () => {
    expect(resolveMapOpen({ itinerary: "it-1" }).back).toEqual({ href: "/itineraries/it-1", label: "しおり" });
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

  /* explore-mode Task 4（2026-10-02）: 絞り込みは URL に持つ（要件 3.4.6） */
  it("探すモードは絞り込みの条件も URL から読む", () => {
    const result = resolveMapOpen({ mode: "explore", lat: "35.1", lng: "139.2", categories: "グルメ", cost: "3000", rating: "4" });
    expect(result.filters).toEqual({ categories: ["グルメ"], cost: "3000", duration: null, minRating: 4 });
  });

  it("条件が付いていなければ条件なし", () => {
    expect(resolveMapOpen({ mode: "explore", lat: "35.1", lng: "139.2" }).filters).toEqual(EMPTY_SPOT_FILTERS);
  });
});
