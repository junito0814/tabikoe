import { describe, expect, it, vi } from "vitest";
import { DEFAULT_NEARBY_RADIUS, parseNearbyRadius, selectNearbyPosts } from "./nearby-posts";

/**
 * 出典: docs/tasks/browsing/explore-mode/01-nearby-posts-api.md 単体テスト
 * - 半径外が除外され、近い順に並ぶこと
 * - 既定半径が 1000 であること
 */
const center = { lat: 35.6812, lng: 139.7671 };
const row = (id: string, lat: number, lng: number) => ({
  id,
  spot_id: `s-${id}`,
  comment: "とても良かったです",
  rating: 4,
  spots: { id: `s-${id}`, name: `スポット${id}`, lat, lng },
  post_photos: [{ storage_url: `${id}.jpg`, display_order: 0 }],
});

describe("selectNearbyPosts", () => {
  it("半径外を除外し、近い順に並ぶ", () => {
    const rows = [
      row("far", 35.70, 139.7671), // 約 2km
      row("near", 35.6822, 139.7671), // 約 110m
      row("mid", 35.687, 139.7671), // 約 640m
    ];
    const result = selectNearbyPosts(rows, center, 1000);
    expect(result.map((post) => post.id)).toEqual(["near", "mid"]);
    // travel-time（2026-09-25）: 徒歩は 60m/分
    expect(result[0].walkMinutes).toBe(2);
    expect(result[1].walkMinutes).toBe(11);
    expect(result[0].thumbnailPath).toBe("near.jpg");
  });

  it("上限件数で切る", () => {
    const rows = Array.from({ length: 30 }, (_, i) => row(String(i), 35.6812 + i * 0.00001, 139.7671));
    expect(selectNearbyPosts(rows, center, 1000, 20)).toHaveLength(20);
  });

  /*
   * explore-mode Task 4（2026-10-02）: 絞り込み。
   * 出典: docs/tasks/map-search/explore-mode/04-filter.md 4-3
   *
   * ここでは代表値の計算をしない。地図のピン側（findMatchingSpotIds）が出した
   * 「条件に合うスポットの id」をもらって、それ以外のスポットの投稿を落とすだけ。
   */
  it("条件に合うスポットの投稿だけ残る（受入条件 100）", () => {
    const rows = [row("a", 35.6822, 139.7671), row("b", 35.6823, 139.7671)];
    const result = selectNearbyPosts(rows, center, 1000, 20, "walk", new Set(["s-b"]));
    expect(result.map((post) => post.id)).toEqual(["b"]);
  });

  it("条件が無い（null）ときは全部残る", () => {
    const rows = [row("a", 35.6822, 139.7671), row("b", 35.6823, 139.7671)];
    expect(selectNearbyPosts(rows, center, 1000, 20, "walk", null)).toHaveLength(2);
  });

  it("合うスポットが 1 つも無ければ 0 件（画面は「条件に合う場所がありません」を出す）", () => {
    const rows = [row("a", 35.6822, 139.7671)];
    expect(selectNearbyPosts(rows, center, 1000, 20, "walk", new Set<string>())).toHaveLength(0);
  });
});

describe("parseNearbyRadius", () => {
  it("既定は 1000、500/1000/3000 以外は既定", () => {
    expect(DEFAULT_NEARBY_RADIUS).toBe(1000);
    expect(parseNearbyRadius(null)).toBe(1000);
    expect(parseNearbyRadius("500")).toBe(500);
    expect(parseNearbyRadius("3000")).toBe(3000);
    expect(parseNearbyRadius("999")).toBe(1000);
  });
});

describe("travel-time Task3（2026-09-26）: バスの半径を 8km に広げる", () => {
  it("5km より遠く 8km より近い投稿が、バスでは入り、徒歩・自転車では入らない", async () => {
    const { radiusForTravelMode, selectNearbyPosts } = await import("./nearby-posts");
    const center = { lat: 35.68, lng: 139.76 };
    // 緯度 0.06 度 ≒ 6.7km
    const row = { id: "p", spot_id: "s", comment: null, rating: null, spots: { id: "s", name: "遠いバス停の先", lat: 35.74, lng: 139.76 }, post_photos: [] };
    expect(selectNearbyPosts([row], center, radiusForTravelMode("bus"), 20, "bus")).toHaveLength(1);
    expect(selectNearbyPosts([row], center, radiusForTravelMode("walk"), 20, "walk")).toHaveLength(0);
    expect(selectNearbyPosts([row], center, radiusForTravelMode("bicycle"), 20, "bicycle")).toHaveLength(0);
  });

  it("他の移動手段の半径は変わらない", async () => {
    const { radiusForTravelMode } = await import("./nearby-posts");
    expect(radiusForTravelMode("walk")).toBe(1000);
    expect(radiusForTravelMode("bicycle")).toBe(3000);
    expect(radiusForTravelMode("car")).toBe(10000);
    expect(radiusForTravelMode("train")).toBe(15000);
  });
});

describe("v3.2: 移動手段", () => {
  it("移動手段ごとの半径（徒歩 1km／自転車 3km／車 10km／電車 15km／バス 5km）と所要時間の目安", async () => {
    const { radiusForTravelMode, selectNearbyPosts } = await import("./nearby-posts");
    expect(radiusForTravelMode("walk")).toBe(1000);
    expect(radiusForTravelMode("bicycle")).toBe(3000);
    expect(radiusForTravelMode("car")).toBe(10000);
    expect(radiusForTravelMode("train")).toBe(15000);
    expect(radiusForTravelMode("bus")).toBe(8000);
    const center = { lat: 35.68, lng: 139.76 };
    const row = { id: "p", spot_id: "s", comment: null, rating: null, spots: { id: "s", name: "遠い店", lat: 35.7, lng: 139.76 }, post_photos: [] };
    // 約 2.2km: 徒歩では範囲外（1km）だが車（10km）では入り、分数は車の速度
    expect(selectNearbyPosts([row], center, 1000, 20, "walk")).toHaveLength(0);
    const byCar = selectNearbyPosts([row], center, 10000, 20, "car");
    expect(byCar).toHaveLength(1);
    expect(byCar[0].mode).toBe("car");
    // Routes API が使えないときの目安（車 300m/分）。実測に差し替えるのは getNearbyPosts の役目
    expect(byCar[0].minutes).toBe(Math.ceil(byCar[0].distanceMeters / 300));
  });
});

describe("getNearbyPosts（2026-09-25: 車・電車・バスは Routes API の実測に差し替える）", () => {
  const rows = [
    { id: "a", spot_id: "s1", comment: null, rating: null, spots: { id: "s1", name: "近い店", lat: 35.685, lng: 139.76 }, post_photos: [] },
    { id: "b", spot_id: "s2", comment: null, rating: null, spots: { id: "s2", name: "遠い店", lat: 35.70, lng: 139.76 }, post_photos: [] },
  ];
  const admin = {
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "gte", "lte", "order", "limit", "not", "in", "or"]) q[m] = () => q;
      q.then = (resolve: (v: unknown) => void) => resolve({ data: rows, error: null });
      return q;
    },
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) },
  } as unknown as Parameters<typeof import("./nearby-posts").getNearbyPosts>[0];

  it("Routes API が返した分数を使い、返らなかった分は直線距離の計算のまま残す", async () => {
    const { getNearbyPosts } = await import("./nearby-posts");
    const fetcher = vi.fn(async () => [9, null]);
    const posts = await getNearbyPosts(admin, "me", { lat: 35.68, lng: 139.76 }, 10000, "car", { travelMinutesFetcher: fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(posts[0].minutes).toBe(9);
    expect(posts[1].minutes).toBe(Math.ceil(posts[1].distanceMeters / 300));
  });

  it("徒歩では Routes API を呼ばない（呼び出し口が全部 null を返す）", async () => {
    const { getNearbyPosts } = await import("./nearby-posts");
    const fetcher = vi.fn(async (_o: unknown, d: unknown[]) => d.map(() => null));
    const posts = await getNearbyPosts(admin, "me", { lat: 35.68, lng: 139.76 }, 1000, "walk", { travelMinutesFetcher: fetcher });
    expect(posts[0].minutes).toBe(Math.ceil(posts[0].distanceMeters / 60));
  });
});
