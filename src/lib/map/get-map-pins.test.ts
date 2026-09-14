import { describe, expect, it } from "vitest";
import {
  aggregateSpotPins,
  MAX_MAP_PINS,
  parseMapBounds,
  selectOwnWishlistPins,
} from "./get-map-pins";

/**
 * 出典: docs/tasks/map-search/map-display/01-spots-fetch-handler.md 単体テスト
 * - 同一スポットへの複数投稿が1件のピンに集約されるロジックを検証する
 * - 非公開投稿のみのスポットが結果から除外されることを検証する
 * - 取得件数が最大100件に制限されることを検証する
 *
 * 出典: docs/tasks/map-search/map-display/02-wishlist-tab-integration.md 単体テスト
 * - ログインユーザー自身の「行きたい」保存スポットのみが対象となり、他ユーザーの保存分が含まれないことを検証する
 */
const spot = (id: string, posts: { user_id: string; visibility: string }[]) => ({
  id,
  name: `スポット${id}`,
  lat: 35,
  lng: 139,
  prefecture: null,
  posts,
});

describe("aggregateSpotPins（全体タブ）", () => {
  it("同一スポットへの複数投稿が1件のピンに集約される", () => {
    const rows = [
      spot("a", [
        { user_id: "u1", visibility: "public" },
        { user_id: "u2", visibility: "public" },
        { user_id: "u3", visibility: "public" },
      ]),
    ];
    const pins = aggregateSpotPins(rows, "me", new Set());
    expect(pins).toHaveLength(1);
    expect(pins[0]).toMatchObject({ spotId: "a", postCount: 3 });
  });

  it("同じスポットの行が重複して渡されても1件にまとまる", () => {
    const rows = [
      spot("a", [{ user_id: "u1", visibility: "public" }]),
      spot("a", [{ user_id: "u1", visibility: "public" }]),
    ];
    expect(aggregateSpotPins(rows, "me", new Set())).toHaveLength(1);
  });

  it("非公開投稿のみのスポットは結果から除外される", () => {
    const rows = [
      spot("private-only", [{ user_id: "u1", visibility: "private" }]),
      spot("mixed", [
        { user_id: "u1", visibility: "private" },
        { user_id: "u2", visibility: "public" },
      ]),
    ];
    const pins = aggregateSpotPins(rows, "me", new Set());
    expect(pins.map((pin) => pin.spotId)).toEqual(["mixed"]);
    // 件数も公開投稿だけを数える
    expect(pins[0].postCount).toBe(1);
  });

  it("取得件数は最大100件に制限される", () => {
    const rows = Array.from({ length: 150 }, (_, index) =>
      spot(`s${index}`, [{ user_id: "u1", visibility: "public" }])
    );
    expect(aggregateSpotPins(rows, "me", new Set())).toHaveLength(MAX_MAP_PINS);
    expect(MAX_MAP_PINS).toBe(100);
  });

  it("自分の投稿・行きたい保存の有無をピンに載せる", () => {
    const rows = [
      spot("a", [{ user_id: "me", visibility: "public" }]),
      spot("b", [{ user_id: "other", visibility: "public" }]),
    ];
    const pins = aggregateSpotPins(rows, "me", new Set(["a"]));
    expect(pins[0]).toMatchObject({ hasOwnPost: true, isWishlisted: true });
    expect(pins[1]).toMatchObject({ hasOwnPost: false, isWishlisted: false });
  });
});

describe("selectOwnWishlistPins（行きたいタブ）", () => {
  const spotRow = (id: string) => ({ id, name: id, lat: 35, lng: 139, prefecture: null });

  it("ログインユーザー自身の保存分だけが対象になり、他ユーザーの保存分は含まれない", () => {
    const rows = [
      { user_id: "me", spot: spotRow("mine") },
      { user_id: "someone", spot: spotRow("theirs") },
      { user_id: "me", spot: spotRow("mine-2") },
    ];
    const pins = selectOwnWishlistPins(rows, "me", new Set(["mine-2"]));
    expect(pins.map((pin) => pin.spotId)).toEqual(["mine", "mine-2"]);
    expect(pins.every((pin) => pin.isWishlisted)).toBe(true);
    expect(pins[1].hasOwnPost).toBe(true);
  });

  it("スポットが消えている行・重複行は落とす", () => {
    const rows = [
      { user_id: "me", spot: null },
      { user_id: "me", spot: spotRow("a") },
      { user_id: "me", spot: spotRow("a") },
    ];
    expect(selectOwnWishlistPins(rows, "me", new Set())).toHaveLength(1);
  });

  it("最大100件に制限される", () => {
    const rows = Array.from({ length: 120 }, (_, index) => ({
      user_id: "me",
      spot: spotRow(`s${index}`),
    }));
    expect(selectOwnWishlistPins(rows, "me", new Set())).toHaveLength(100);
  });
});

describe("parseMapBounds", () => {
  it("4辺が揃っていれば矩形として読む", () => {
    const params = new URLSearchParams({ north: "35.7", south: "35.6", east: "139.8", west: "139.7" });
    expect(parseMapBounds(params)).toEqual({ north: 35.7, south: 35.6, east: 139.8, west: 139.7 });
  });

  it("欠けている・数値でない・南北が逆の場合はnull", () => {
    expect(parseMapBounds(new URLSearchParams({ north: "35" }))).toBeNull();
    expect(
      parseMapBounds(new URLSearchParams({ north: "x", south: "35", east: "139", west: "139" }))
    ).toBeNull();
    expect(
      parseMapBounds(new URLSearchParams({ north: "35", south: "36", east: "139", west: "139" }))
    ).toBeNull();
  });
});
