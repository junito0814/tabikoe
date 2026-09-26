import { describe, expect, it } from "vitest";
import { averageRating, MAX_MAP_PINS, mergeMapPins, parseMapBounds } from "./get-map-pins";

/**
 * 出典: docs/tasks/map-search/map-display-v3/01-pins-api-kinds.md 単体テスト
 * - saved と post の両方に該当するスポットが saved 1 件になること
 * - 下書きが本人にだけ含まれること（下書きは呼び出し側が本人分だけ渡す前提。ここでは別ピンになることを確認）
 * 出典: docs/tasks/map-search/map-display/01-spots-fetch-handler.md 単体テスト（v1 から引き継ぎ）
 * - 同一スポットへの複数投稿が1件のピンに集約される・非公開投稿のみのスポットは除外・最大100件
 */
const spot = (id: string, posts: { user_id: string; visibility: string; rating: number | null; category?: string | null; created_at?: string | null }[]) => ({
  id,
  name: `スポット${id}`,
  lat: 35,
  lng: 139,
  prefecture: null,
  posts,
});
const plain = (id: string) => ({ id, name: `スポット${id}`, lat: 35, lng: 139, prefecture: "東京都" });
const pub = (rating: number | null = 4) => ({ user_id: "u1", visibility: "public", rating });
/** pin-categories Task2: カテゴリつきの公開投稿 */
const pubCat = (category: string, createdAt: string) => ({ user_id: "u1", visibility: "public", rating: 4, category, created_at: createdAt });

describe("mergeMapPins", () => {
  it("同一スポットへの複数投稿が1件のピンに集約され、件数と星平均が付く", () => {
    const pins = mergeMapPins([spot("a", [pub(5), pub(4), pub(null)])], [], []);
    expect(pins).toHaveLength(1);
    expect(pins[0]).toMatchObject({ id: "a", kind: "post", postCount: 3, ratingAverage: 4.5 });
  });

  it("非公開投稿のみのスポットは投稿ピンにならない", () => {
    expect(mergeMapPins([spot("a", [{ user_id: "u1", visibility: "private", rating: 3 }])], [], [])).toEqual([]);
  });

  it("saved と post の両方に該当するスポットは saved 1 件（投稿の集計は保持）", () => {
    const pins = mergeMapPins([spot("a", [pub(3)]), spot("b", [pub(5)])], [plain("a")], []);
    expect(pins.map((pin) => [pin.id, pin.kind])).toEqual([
      ["a", "saved"],
      ["b", "post"],
    ]);
    expect(pins[0]).toMatchObject({ postCount: 1, ratingAverage: 3 });
  });

  it("行きたいとしおりの両方に入っていても 1 本", () => {
    expect(mergeMapPins([], [plain("a"), plain("a")], [])).toHaveLength(1);
  });

  it("下書きは別のピン（スポット未確定なら「名前のない場所」）", () => {
    const pins = mergeMapPins([spot("a", [pub()])], [], [
      { id: "d1", lat: 35.1, lng: 139.1, spot: null },
      { id: "d2", lat: 35.2, lng: 139.2, spot: plain("a") },
    ]);
    expect(pins.map((pin) => pin.id)).toEqual(["a", "draft:d1", "draft:d2"]);
    expect(pins[1]).toMatchObject({ kind: "draft", name: "名前のない場所", draftId: "d1", spotId: null });
    expect(pins[2]).toMatchObject({ kind: "draft", name: "スポットa", spotId: "a" });
  });

  it("最新の「まだあった」報告を付ける", () => {
    const status = { status: "still_there" as const, reportedAt: "2026-09-01T00:00:00Z" };
    const pins = mergeMapPins([spot("a", [pub()])], [], [], new Map([["a", status]]));
    expect(pins[0].latestStatus).toEqual(status);
  });

  it("最大100件に制限される", () => {
    const rows = Array.from({ length: 150 }, (_, i) => spot(String(i), [pub()]));
    expect(mergeMapPins(rows, [], [])).toHaveLength(MAX_MAP_PINS);
  });
});

describe("averageRating", () => {
  it("小数 1 桁に丸め、評価が無ければ null", () => {
    expect(averageRating([5, 4, 4])).toBe(4.3);
    expect(averageRating([null])).toBeNull();
  });
});

describe("parseMapBounds", () => {
  it("4辺が揃っていれば受理する", () => {
    expect(parseMapBounds(new URLSearchParams({ north: "35.7", south: "35.6", east: "139.8", west: "139.7" }))).toEqual({
      north: 35.7,
      south: 35.6,
      east: 139.8,
      west: 139.7,
    });
  });

  it("欠け・数値でない・逆転は拒否する", () => {
    expect(parseMapBounds(new URLSearchParams({ north: "35.7" }))).toBeNull();
    expect(parseMapBounds(new URLSearchParams({ north: "x", south: "35.6", east: "139.8", west: "139.7" }))).toBeNull();
    expect(parseMapBounds(new URLSearchParams({ north: "35.6", south: "35.7", east: "139.8", west: "139.7" }))).toBeNull();
  });
});

/**
 * 出典: docs/tasks/shared-ui/pin-categories/02-spot-category-resolution.md 単体テスト
 * 要件定義書 4.5.3「スポットのカテゴリの決め方」
 */
describe("ピンのカテゴリ（pin-categories Task2）", () => {
  it("公開投稿でいちばん多いカテゴリがピンに乗る", () => {
    const pins = mergeMapPins(
      [spot("a", [pubCat("グルメ", "2026-09-01T00:00:00Z"), pubCat("観光スポット", "2026-09-02T00:00:00Z"), pubCat("グルメ", "2026-09-03T00:00:00Z")])],
      [],
      []
    );
    expect(pins[0].category).toBe("グルメ");
  });

  it("非公開の投稿はカテゴリの数に入れない", () => {
    const pins = mergeMapPins(
      [spot("a", [pubCat("グルメ", "2026-09-01T00:00:00Z"), { user_id: "u1", visibility: "private", rating: 5, category: "宿泊施設", created_at: "2026-09-09T00:00:00Z" }])],
      [],
      []
    );
    expect(pins[0].category).toBe("グルメ");
  });

  it("カテゴリが分からなければ null（灰色のピンになる）", () => {
    expect(mergeMapPins([spot("a", [pub(4)])], [], [])[0].category).toBeNull();
  });

  it("保存済みのピンにもカテゴリが乗る（色は状態ではなくカテゴリで決まる）", () => {
    const pins = mergeMapPins([spot("a", [pubCat("宿泊施設", "2026-09-01T00:00:00Z")])], [plain("a")], []);
    expect(pins[0]).toMatchObject({ kind: "saved", category: "宿泊施設" });
  });

  it("下書きのピンはカテゴリを持たない", () => {
    const pins = mergeMapPins([], [], [{ id: "d1", lat: 35, lng: 139, spot: null }]);
    expect(pins[0]).toMatchObject({ kind: "draft", category: null });
  });
});
