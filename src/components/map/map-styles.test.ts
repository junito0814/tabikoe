/**
 * 出典: docs/tasks/shared-ui/theme/02-dark-mode-variables-and-map-style.md（単体テスト）
 * 「matchMedia をモックし、ダーク時にダーク用スタイル配列が渡されること」
 * 「スタイル配列に POI ラベル非表示・道路名のズーム条件が含まれること」
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMapStyles, detectMapTheme, ROAD_LABEL_MIN_ZOOM } from "./map-styles";

function hasRule(styles: google.maps.MapTypeStyle[], featureType: string, elementType?: string, visibility?: string) {
  return styles.some(
    (s) =>
      s.featureType === featureType &&
      (elementType === undefined || s.elementType === elementType) &&
      (visibility === undefined || s.stylers?.some((st) => (st as { visibility?: string }).visibility === visibility))
  );
}

describe("buildMapStyles", () => {
  it("POI のラベルを非表示にする", () => {
    expect(hasRule(buildMapStyles("light", 14), "poi", "labels", "off")).toBe(true);
  });
  it("駅名は残す", () => {
    expect(hasRule(buildMapStyles("light", 14), "transit.station.rail", "labels", "on")).toBe(true);
  });
  it(`道路名はズーム ${ROAD_LABEL_MIN_ZOOM} 未満で非表示、以上で表示`, () => {
    expect(hasRule(buildMapStyles("light", ROAD_LABEL_MIN_ZOOM - 1), "road", "labels", "off")).toBe(true);
    expect(hasRule(buildMapStyles("light", ROAD_LABEL_MIN_ZOOM), "road", "labels", "off")).toBe(false);
  });
  it("ダークでは下地の色が夜の値になる", () => {
    const dark = buildMapStyles("dark", 14).find((s) => s.elementType === "geometry" && !s.featureType);
    expect(JSON.stringify(dark)).toContain("#111926");
  });
});

describe("detectMapTheme", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("matchMedia がダークなら dark", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} }));
    expect(detectMapTheme()).toBe("dark");
  });
  it("ライトなら light", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }));
    expect(detectMapTheme()).toBe("light");
  });
});

describe("buildMapOptions（map-display-v3 Task3）", () => {
  it("styles と disableDefaultUI 系の設定を含む", async () => {
    const { buildMapOptions } = await import("./map-styles");
    const options = buildMapOptions("light", 14);
    expect(options.disableDefaultUI).toBe(true);
    expect(options.mapTypeControl).toBe(false);
    expect(options.streetViewControl).toBe(false);
    expect(options.rotateControl).toBe(false);
    expect(options.tilt).toBe(0);
    expect(options.clickableIcons).toBe(false);
    expect(options.zoomControl).toBe(true);
    expect(Array.isArray(options.styles)).toBe(true);
    expect(options.styles.length).toBeGreaterThan(0);
  });
});
