import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * 出典: #703（seed データを作り直す）単体テスト
 *
 * 置き場所について: vitest は `src/**` しか見ないので、`scripts/seed/` ではなくここに置いている。
 *
 * 【初心者向け】写真そのものは機械では確かめられない（人が写っているかは目で見た）。
 * ここで見張るのは**記録が揃っているか**と**決まりを破る形になっていないか**。
 *   - Pixabay 以外の URL が混ざっていないか
 *   - 風景か食べ物だけか
 *   - 外した写真の理由が残っているか
 *   - seed のスクリプトに外部の画像 URL が残っていないか（picsum・pravatar）
 */
const photos = JSON.parse(readFileSync("scripts/seed/photos.json", "utf8")) as {
  source: string;
  fetchedAt: string;
  checkedBy: string;
  photos: { file: string; kind: string; what: string; url: string }[];
  rejected: { url: string; reason: string }[];
};

describe("seed の写真（#703）", () => {
  it("全部 Pixabay から取っている", () => {
    expect(photos.photos.length).toBeGreaterThan(0);
    for (const photo of photos.photos) {
      expect(photo.url, photo.file).toMatch(/^https:\/\/cdn\.pixabay\.com\//);
    }
  });

  it("風景か食べ物だけ", () => {
    for (const photo of photos.photos) {
      expect(["landscape", "food"], photo.file).toContain(photo.kind);
    }
  });

  it("取得元・取得日・目で見た記録が残っている", () => {
    expect(photos.source).toContain("Pixabay");
    expect(photos.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(photos.checkedBy).toContain("目で見て");
  });

  it("外した写真は理由つきで残っている（人が写っていたもの）", () => {
    expect(photos.rejected.length).toBeGreaterThan(0);
    for (const rejected of photos.rejected) {
      expect(rejected.reason.length).toBeGreaterThan(0);
    }
  });

  it("名前が重なっていない", () => {
    const files = photos.photos.map((photo) => photo.file);
    expect(new Set(files).size).toBe(files.length);
  });
});

describe("seed のスクリプト（#703）", () => {
  const seed = readFileSync("scripts/seed/seed-tokyo.mjs", "utf8");

  it("外部の画像 URL を貼らない（picsum・pravatar をやめた）", () => {
    expect(seed).not.toContain("picsum.photos");
    expect(seed).not.toContain("pravatar.cc");
  });

  it("アイコンはアプリの既定", () => {
    expect(seed).toContain('avatar_url: "/default-avatar.svg"');
  });

  it("スポットに Place ID を入れる", () => {
    expect(seed).toContain("place_id: placeIdOf.get(s.name)");
  });

  it("写真は Storage に入れてからパスを保存する", () => {
    expect(seed).toContain("uploadSeedPhotos");
    expect(seed).toContain('from("post-media")');
  });
});

describe("Place ID の記録（#703・#700）", () => {
  const placeIds = JSON.parse(readFileSync("scripts/seed/place-ids.json", "utf8")) as {
    resolvedAt: string;
    spots: { name: string; placeId: string | null }[];
  };

  it("いつ引いたかが残っている", () => {
    expect(placeIds.resolvedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("Google にある想定のスポットには Place ID が入っている", () => {
    const resolved = placeIds.spots.filter((spot) => spot.placeId !== null);
    expect(resolved.length).toBeGreaterThan(20);
  });
});
