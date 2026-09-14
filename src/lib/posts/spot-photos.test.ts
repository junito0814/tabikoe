import { describe, expect, it } from "vitest";
import { mergeSpotMedia, type SpotPostMediaRow } from "./spot-photos";

/**
 * 出典: docs/tasks/map-search/spot-photo-gallery/01-spot-photos-handler.md 単体テスト
 * - 複数投稿にまたがる写真・動画が正しく統合され、新着順にソートされることを検証する
 * - 非公開投稿の写真・動画が結果に含まれないことを検証する
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

  it("includePrivate を指定すると非公開投稿の写真も含める（アルバム写真一覧 SC-21 用）", () => {
    const rows = [
      row("private", "2026-09-05T00:00:00Z", "private", [{ id: "p1", order: 0 }]),
      row("public", "2026-09-01T00:00:00Z", "public", [{ id: "q1", order: 0 }]),
    ];
    expect(mergeSpotMedia(rows, { includePrivate: true }).map((item) => item.key)).toEqual(["p1", "q1"]);
  });

  it("保存パスの無い行は落とす", () => {
    const rows = [row("a", "2026-09-01T00:00:00Z", "public", [{ id: "x", order: 0, path: null }])];
    expect(mergeSpotMedia(rows)).toEqual([]);
  });
});
