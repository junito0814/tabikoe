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

/**
 * 出典: docs/tasks/map-search/explore-mode/04-filter.md 単体テスト
 *       #656（探すモードの絞り込み）
 * 要件定義書 3.4.6「絞り込み」・8 章 100
 *
 * 【初心者向け】絞り込みは**投稿を間引くのではなく、スポットごと落とす**。
 * そうすると、残ったスポットの件数・評価・色は**そのスポットの全公開投稿**から出た値のままになる。
 * 「3 件」と出ているのに開いたら 1 件、ということが起きない。
 */
describe("mergeMapPins の絞り込み（#656）", () => {
  const withPosts = (id: string, posts: { rating: number | null; category?: string; cost?: number | null; duration?: string }[], source = "places") => ({
    id,
    name: `スポット${id}`,
    lat: 35,
    lng: 139,
    prefecture: null,
    source,
    posts: posts.map((p) => ({
      user_id: "u1",
      visibility: "public",
      rating: p.rating,
      category: p.category ?? "グルメ",
      cost: p.cost ?? 1000,
      duration: p.duration ?? "1時間以内",
      created_at: "2026-09-01T00:00:00Z",
    })),
  });
  const filters = (over: Partial<Parameters<typeof mergeMapPins>[5] & object> = {}) => ({
    categories: [],
    cost: null,
    duration: null,
    minRating: null,
    manualOnly: false,
    ...over,
  });

  it("条件に合わないスポットはピンごと消える", () => {
    const pins = mergeMapPins(
      [withPosts("a", [{ rating: 5 }]), withPosts("b", [{ rating: 2 }])],
      [], [], new Map(), MAX_MAP_PINS,
      filters({ minRating: 4 })
    );
    expect(pins.map((pin) => pin.id)).toEqual(["a"]);
  });

  it("残ったピンの件数・評価は、そのスポットの全公開投稿から出る", () => {
    // ★5 が 2 件・★4 が 1 件 → 件数 3・平均 4.7。間引いた数にならないこと
    const pins = mergeMapPins(
      [withPosts("a", [{ rating: 5 }, { rating: 5 }, { rating: 4 }])],
      [], [], new Map(), MAX_MAP_PINS,
      filters({ minRating: 4 })
    );
    expect(pins[0].postCount).toBe(3);
    expect(pins[0].ratingAverage).toBe(4.7);
  });

  it("平均で切る（1 件だけ ★5 でも、平均が届かなければ落ちる）", () => {
    const pins = mergeMapPins(
      [withPosts("a", [{ rating: 5 }, { rating: 2 }])],
      [], [], new Map(), MAX_MAP_PINS,
      filters({ minRating: 4 })
    );
    expect(pins).toHaveLength(0);
  });

  it("「タビコエだけの場所」だけを出す", () => {
    const pins = mergeMapPins(
      [withPosts("a", [{ rating: 4 }], "manual"), withPosts("b", [{ rating: 4 }], "places")],
      [], [], new Map(), MAX_MAP_PINS,
      filters({ manualOnly: true })
    );
    expect(pins.map((pin) => pin.id)).toEqual(["a"]);
  });

  it("カテゴリは代表（いちばん多いもの）で見る。ピンの色と食い違わない", () => {
    const pins = mergeMapPins(
      [withPosts("a", [{ rating: 4, category: "グルメ" }, { rating: 4, category: "観光スポット" }, { rating: 4, category: "観光スポット" }])],
      [], [], new Map(), MAX_MAP_PINS,
      filters({ categories: ["観光スポット"] })
    );
    expect(pins).toHaveLength(1);
    // 絞り込みで残ったのだから、ピンの色も同じカテゴリでなければおかしい
    expect(pins[0].category).toBe("観光スポット");
  });

  it("絞り込み中は、保存済みと下書きのピンを出さない", () => {
    // 条件に合わないピンが残ると「絞り込んだのに出ている」と壊れて見えるため
    const pins = mergeMapPins(
      [withPosts("a", [{ rating: 5 }])],
      [plain("saved-1")],
      [{ id: "d1", lat: 35, lng: 139, spot: null }],
      new Map(), MAX_MAP_PINS,
      filters({ minRating: 4 })
    );
    expect(pins.map((pin) => pin.id)).toEqual(["a"]);
  });

  it("条件が無ければ、今までどおり全部出る", () => {
    const pins = mergeMapPins(
      [withPosts("a", [{ rating: 2 }])],
      [plain("saved-1")],
      [{ id: "d1", lat: 35, lng: 139, spot: null }],
      new Map(), MAX_MAP_PINS,
      filters()
    );
    expect(pins.map((pin) => pin.id).sort()).toEqual(["a", "draft:d1", "saved-1"]);
  });
});
