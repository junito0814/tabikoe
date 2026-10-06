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

  it("map-style Bug1: 山・湖などの自然地形のラベルも消す（Google の緑のアイコンがピンと紛らわしいため）", () => {
    const styles = buildMapStyles("light", 14);
    const natural = styles.find((style) => style.featureType === "landscape.natural" && style.elementType === "labels");
    expect(natural?.stylers).toEqual([{ visibility: "off" }]);
  });

  it("駅名は今までどおり残す（自然地形を消しても影響しない）", () => {
    const styles = buildMapStyles("light", 14);
    const rail = styles.find((style) => style.featureType === "transit.station.rail" && style.elementType === "labels");
    expect(rail?.stylers).toEqual([{ visibility: "on" }]);
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

  /**
   * map-sheet Task1（要件定義書 4.5.8）: 拡大縮小ボタンを出す条件
   * 【初心者向け】matchMedia はテスト環境（jsdom）には無いので、ここで偽物を差し込んで
   * 「指で触れる端末」を作っている。afterEach で元に戻す。
   */
  describe("拡大縮小ボタン（＋ −）を出す条件", () => {
    const original = window.matchMedia;
    afterEach(() => {
      window.matchMedia = original;
    });
    const setPointer = (coarse: boolean, phone = false) => {
      window.matchMedia = ((query: string) => ({
        matches: query.includes("pointer: coarse") ? coarse : query.includes("max-width") ? phone : false,
        addEventListener: () => {},
        removeEventListener: () => {},
      })) as unknown as typeof window.matchMedia;
    };

    it("指で触れる端末では出さない", async () => {
      const { buildMapOptions } = await import("./map-styles");
      setPointer(true);
      expect(buildMapOptions("light", 14, "greedy").zoomControl).toBe(false);
    });

    it("指で触れない端末（パソコン）では出す", async () => {
      const { buildMapOptions } = await import("./map-styles");
      setPointer(false);
      expect(buildMapOptions("light", 14, "greedy").zoomControl).toBe(true);
    });

    it("上部の地図（cooperative）では端末を問わず出さない", async () => {
      const { buildMapOptions } = await import("./map-styles");
      setPointer(false);
      expect(buildMapOptions("light", 14, "cooperative").zoomControl).toBe(false);
    });

    /**
     * #801（2026-10-06）: スマホ幅では出さない
     * 出典: Issue #801「スマホ幅では地図の ＋/− ズームボタンを出さない」
     *
     * 【初心者向け】「指で触れるか」だけで見ていたので、**投稿を書く画面の地図にだけ ＋/− が出て**いた。
     * 幅でも見るようにして、スマホ幅ではどの地図にも出さない。
     */
    it("#801: スマホ幅（768px 未満）では、指で触れなくても出さない", async () => {
      const { buildMapOptions } = await import("./map-styles");
      setPointer(false, true);
      expect(buildMapOptions("light", 14, "greedy").zoomControl).toBe(false);
    });

    it("#801: パソコン（768px 以上・指で触れない）では今までどおり出す", async () => {
      const { buildMapOptions } = await import("./map-styles");
      setPointer(false, false);
      expect(buildMapOptions("light", 14, "greedy").zoomControl).toBe(true);
    });

    it("matchMedia が無い環境（サーバー側の描画）では出す側に倒す", async () => {
      const { buildMapOptions } = await import("./map-styles");
      // @ts-expect-error テストのために一時的に消す
      delete window.matchMedia;
      expect(buildMapOptions("light", 14, "greedy").zoomControl).toBe(true);
    });
  });

  it("gesture をそのまま gestureHandling に渡す", async () => {
    const { buildMapOptions } = await import("./map-styles");
    expect(buildMapOptions("light", 14, "cooperative").gestureHandling).toBe("cooperative");
    expect(buildMapOptions("light", 14, "none").gestureHandling).toBe("none");
  });

  /**
   * #787（2026-10-06）: キーボード ショートカットの印（⌨）を出さない
   * 出典: Issue #787「地図のキーボード ショートカットの印（⌨）を出さない」
   */
  it("キーボード ショートカットの印はどの地図でも出さない（スマホにキーボードは無い）", async () => {
    const { buildMapOptions } = await import("./map-styles");
    for (const gesture of ["none", "cooperative", "greedy"] as const) {
      expect(buildMapOptions("light", 14, gesture).keyboardShortcuts, gesture).toBe(false);
    }
  });
});
