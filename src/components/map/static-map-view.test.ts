import { describe, expect, it } from "vitest";
import { isSameView, SAME_VIEW_DEGREES } from "./static-map-view";

/**
 * 出典: docs/tasks/shared-ui/map-sheet/01-pinch-and-zoom-controls.md 単体テスト
 * 「戻す」を出すかどうかの判定（要件定義書 4.5.8）
 */
const base = { center: { lat: 35.681, lng: 139.767 }, zoom: 15 };

describe("isSameView（上部の地図が動いたかの判定）", () => {
  it("まったく同じなら同じ", () => {
    expect(isSameView(base, { center: { ...base.center }, zoom: 15 })).toBe(true);
  });

  it("ごくわずかなずれは同じと見なす（地図の内部の丸め）", () => {
    const center = { lat: base.center.lat + SAME_VIEW_DEGREES / 2, lng: base.center.lng };
    expect(isSameView(base, { center, zoom: 15 })).toBe(true);
  });

  it("動かしたら違うと分かる", () => {
    expect(isSameView(base, { center: { lat: 35.69, lng: 139.767 }, zoom: 15 })).toBe(false);
  });

  it("ズームだけ変えても違うと分かる", () => {
    expect(isSameView(base, { center: { ...base.center }, zoom: 17 })).toBe(false);
  });
});
