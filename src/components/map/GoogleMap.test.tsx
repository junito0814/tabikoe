import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * 出典: docs/tasks/shared-ui/map-sheet/01-pinch-and-zoom-controls.md 単体テスト
 * 「gesture の値が Google マップのオプションに正しく渡ること」（要件定義書 4.5.8）
 *
 * 【初心者向け】Google マップの本体（google.maps.Map）はテストでは読み込めないので、
 * window.google に最低限の偽物を置き、`new google.maps.Map(...)` に渡されたオプションを覗く。
 */
const created: Record<string, unknown>[] = [];

class FakeMap {
  constructor(_container: HTMLElement, options: Record<string, unknown>) {
    created.push(options);
  }
  addListener() {
    return { remove: () => {} };
  }
  getZoom() {
    return 15;
  }
  getBounds() {
    return null;
  }
  getCenter() {
    return null;
  }
  setOptions() {}
}

vi.mock("./use-google-maps", () => ({ useGoogleMaps: () => "ready" }));
vi.mock("@googlemaps/markerclusterer", () => ({
  MarkerClusterer: class {
    clearMarkers() {}
    addMarkers() {}
  },
}));

const { GoogleMap } = await import("./GoogleMap");

beforeEach(() => {
  created.length = 0;
  (window as unknown as { google: unknown }).google = { maps: { Map: FakeMap, Marker: class {}, Circle: class {} } };
});

const base = { initialCenter: { lat: 35.68, lng: 139.76 }, initialZoom: 15, pins: [] };

describe("GoogleMap の gesture（4.5.8）", () => {
  it("既定（全画面の地図）は 1 本指でも動く", () => {
    render(<GoogleMap {...base} />);
    expect(created[0].gestureHandling).toBe("greedy");
    // 指で触れない環境（テスト）では拡大縮小ボタンを出す
    expect(created[0].zoomControl).toBe(true);
  });

  it("上部の地図は 2 本指でだけ動き、拡大縮小ボタンを出さない", () => {
    render(<GoogleMap {...base} gesture="cooperative" />);
    expect(created[0].gestureHandling).toBe("cooperative");
    expect(created[0].zoomControl).toBe(false);
  });

  it("見るだけの地図はキーボード操作も止める", () => {
    render(<GoogleMap {...base} gesture="none" />);
    expect(created[0].gestureHandling).toBe("none");
    expect(created[0].keyboardShortcuts).toBe(false);
  });
});
