import { describe, expect, it } from "vitest";
import { mergeMedia, mergeMediaBySpot, mergeSpotMedia, PHOTOS_PER_SPOT_CAP, type SpotPostMediaRow } from "./search-photos";
import type { SearchRow } from "./search-posts";

/**
 * 出典: docs/tasks/map-search/spot-photo-gallery/01-spot-photos-handler.md 単体テスト
 * - 複数投稿にまたがる写真・動画が正しく統合され、新着順にソートされることを検証する
 * - 非公開投稿の写真・動画が結果に含まれないことを検証する
 * 出典: docs/tasks/map-search/photo-view/01-photos-api-search-params.md 単体テスト
 * - 並び替えが投稿の順序に従い、同じ投稿の写真が添付順で連続すること
 */
const row = (
  id: string,
  createdAt: string,
  visibility: string,
  photos: { id: string; order: number; type?: string; path?: string | null }[]
): SpotPostMediaRow => ({
  id,
  created_at: createdAt,
  visibility,
  spots: { name: "東京駅" },
  post_photos: photos.map((photo) => ({
    id: photo.id,
    storage_url: photo.path === undefined ? `${id}/${photo.id}.jpg` : photo.path,
    video_url: null,
    media_type: photo.type ?? "photo",
    display_order: photo.order,
  })),
});

describe("mergeSpotMedia", () => {
  it("複数投稿の写真を統合し、投稿日時が新しい順・同一投稿内は表示順で並べる", () => {
    const rows = [
      row("old", "2026-09-01T00:00:00Z", "public", [{ id: "o2", order: 1 }, { id: "o1", order: 0 }]),
      row("new", "2026-09-03T00:00:00Z", "public", [{ id: "n1", order: 0 }]),
      row("mid", "2026-09-02T00:00:00Z", "public", [{ id: "m1", order: 0, type: "video" }]),
    ];
    const merged = mergeSpotMedia(rows);
    expect(merged.map((item) => item.key)).toEqual(["n1", "m1", "o1", "o2"]);
    expect(merged[1].mediaType).toBe("video");
    expect(merged[2].postId).toBe("old");
  });

  it("非公開投稿の写真・動画は含まれない", () => {
    const rows = [
      row("private", "2026-09-05T00:00:00Z", "private", [{ id: "p1", order: 0 }]),
      row("public", "2026-09-01T00:00:00Z", "public", [{ id: "q1", order: 0 }]),
    ];
    expect(mergeSpotMedia(rows).map((item) => item.key)).toEqual(["q1"]);
  });

  it("保存パスの無い行は落とす", () => {
    const rows = [row("a", "2026-09-01T00:00:00Z", "public", [{ id: "x", order: 0, path: null }])];
    expect(mergeSpotMedia(rows)).toEqual([]);
  });
});

describe("mergeMedia（v3.0: 投稿の順序に従う）", () => {
  it("渡された投稿の順序を保ち、同じ投稿の写真は添付順で連続する", () => {
    const rows = [
      row("second", "2026-09-03T00:00:00Z", "public", [{ id: "s2", order: 1 }, { id: "s1", order: 0 }]),
      row("first", "2026-09-01T00:00:00Z", "public", [{ id: "f1", order: 0 }]),
    ];
    // いいね順などで「古い投稿が先」に並んでいても、その順序を尊重する
    expect(mergeMedia(rows).map((item) => item.key)).toEqual(["s1", "s2", "f1"]);
  });
});

describe("mergeMediaBySpot（v3.1: 検索結果は 1 スポット 5 枚まで）", () => {
  const searchRow = (id: string, spotId: string, createdAt: string, photoCount: number, rating = 4): SearchRow => ({
    id,
    spot_id: spotId,
    user_id: "u1",
    category: "グルメ",
    visit_date: "2026-09-01",
    duration: null,
    cost: null,
    rating,
    comment: null,
    created_at: createdAt,
    visibility: "public",
    spots: { id: spotId, name: spotId, lat: 35, lng: 139, source: "places", prefecture: "東京都" },
    users: null,
    post_photos: Array.from({ length: photoCount }, (_, i) => ({ id: `${id}-${i}`, storage_url: `${id}/${i}.jpg`, video_url: null, media_type: "photo", display_order: i })),
    likes: [{ count: 0 }],
    comments: [{ count: 0 }],
  });

  it("1 スポット 6 枚以上あっても 5 枚になり、新しい投稿の写真から採る", () => {
    const rows = [searchRow("old", "s1", "2026-09-01T00:00:00Z", 4), searchRow("new", "s1", "2026-09-05T00:00:00Z", 3)];
    const merged = mergeMediaBySpot(rows, "newest", PHOTOS_PER_SPOT_CAP);
    expect(merged).toHaveLength(5);
    expect(merged.map((m) => m.postId)).toEqual(["new", "new", "new", "old", "old"]);
  });

  it("スポットの並び（投稿数順）に従い、各スポットの写真がまとまる", () => {
    const rows = [searchRow("a1", "s1", "2026-09-09T00:00:00Z", 1), searchRow("b1", "s2", "2026-09-01T00:00:00Z", 1), searchRow("b2", "s2", "2026-09-02T00:00:00Z", 1)];
    expect(mergeMediaBySpot(rows, "count", 5).map((m) => m.postId)).toEqual(["b2", "b1", "a1"]);
    expect(mergeMediaBySpot(rows, "newest", 5).map((m) => m.postId)).toEqual(["a1", "b2", "b1"]);
  });
});
