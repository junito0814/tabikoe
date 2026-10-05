import { describe, expect, it } from "vitest";
import { boundsOfPoints, rectCorners } from "./fit-bounds";

/**
 * 出典: #681（検索結果に「地図」タブを足す）単体テスト
 * 要件定義書 3.4.2
 */
describe("boundsOfPoints", () => {
  it("全部の点が入る", () => {
    const rect = boundsOfPoints([
      { lat: 35.0, lng: 139.0 },
      { lat: 36.0, lng: 140.0 },
    ])!;
    expect(rect.south).toBeLessThanOrEqual(35.0);
    expect(rect.north).toBeGreaterThanOrEqual(36.0);
    expect(rect.west).toBeLessThanOrEqual(139.0);
    expect(rect.east).toBeGreaterThanOrEqual(140.0);
  });

  /** 【初心者向け】端に貼り付くと「まだ外にもある」ように見えるので、少し余白を取る */
  it("端に貼り付かないよう余白が付く", () => {
    const rect = boundsOfPoints([
      { lat: 35.0, lng: 139.0 },
      { lat: 36.0, lng: 140.0 },
    ])!;
    expect(rect.north).toBeGreaterThan(36.0);
    expect(rect.south).toBeLessThan(35.0);
  });

  it("1 件だけなら決め打ちの広さにする（広がりが 0 で地図が壊れないように）", () => {
    const rect = boundsOfPoints([{ lat: 35.0, lng: 139.0 }])!;
    expect(rect.north - rect.south).toBeCloseTo(0.02, 5);
    expect(rect.east - rect.west).toBeCloseTo(0.02, 5);
  });

  it("1 件も無ければ null（地図を動かさない）", () => {
    expect(boundsOfPoints([])).toBeNull();
  });

  it("緯度は 90 度を超えない", () => {
    const rect = boundsOfPoints([{ lat: 89.999, lng: 0 }])!;
    expect(rect.north).toBeLessThanOrEqual(90);
  });
});

describe("rectCorners", () => {
  it("南西と北東の 2 点にする", () => {
    const corners = rectCorners({ north: 36, south: 35, east: 140, west: 139 });
    expect(corners).toEqual([
      { lat: 35, lng: 139 },
      { lat: 36, lng: 140 },
    ]);
  });
});
