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
/** #761: マーカーに渡されたオプション（大きさ・重なり順）を覗く */
const markers: Record<string, unknown>[] = [];

class FakeMarker {
  constructor(options: Record<string, unknown>) {
    markers.push(options);
  }
  addListener() {
    return { remove: () => {} };
  }
  setMap() {}
}

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

const { GoogleMap, SELECTED_PIN_SCALE } = await import("./GoogleMap");

beforeEach(() => {
  created.length = 0;
  markers.length = 0;
  (window as unknown as { google: unknown }).google = {
    maps: {
      Map: FakeMap,
      Marker: FakeMarker,
      Circle: class {},
      Size: class {
        constructor(
          readonly width: number,
          readonly height: number
        ) {}
      },
      Point: class {
        constructor(
          readonly x: number,
          readonly y: number
        ) {}
      },
    },
  };
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

/**
 * #761（2026-10-06）: 選んだピンを地図の上でも大きくする
 * 出典: Issue #761「しおりの地図のピンをタップしたら、一覧のその行へ飛んで光らせる」
 */
describe("選んだピンの見た目（#761）", () => {
  const pins = [
    { id: "a", lat: 35.1, lng: 139.1, type: "numbered" as const, label: 1 },
    { id: "b", lat: 35.2, lng: 139.2, type: "numbered" as const, label: 2, selected: true },
  ];

  it("selected のピンだけ 1.35 倍で、指す点も同じ倍率で伸びる", () => {
    render(<GoogleMap {...base} pins={pins} />);
    const [normal, selected] = markers.map((marker) => marker.icon as { scaledSize: { width: number }; anchor: { x: number; y: number } });
    expect(selected.scaledSize.width).toBeCloseTo(normal.scaledSize.width * SELECTED_PIN_SCALE);
    expect(selected.anchor.x).toBeCloseTo(normal.anchor.x * SELECTED_PIN_SCALE);
    expect(selected.anchor.y).toBeCloseTo(normal.anchor.y * SELECTED_PIN_SCALE);
  });

  it("selected のピンは他のピンより前に出る", () => {
    render(<GoogleMap {...base} pins={pins} />);
    expect(markers[0].zIndex).toBeUndefined();
    expect(markers[1].zIndex).toBe(1000);
  });
});
