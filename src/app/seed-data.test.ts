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

/**
 * 2026-10-06: seed のスポットが二重になった後始末の道具。
 *
 * 【初心者向け】`clean-seed.mjs` は**投稿が残っているスポットを消せない**（消すと投稿も一緒に
 * 消えるため、わざとそうしている）。止まったまま `seed-tokyo.mjs` を動かすと同じ名前が 2 つ並ぶ。
 * 直す道具の**安全の決まり**が緩まないよう、ここで見張る。
 */
describe("二重になったスポットを消す道具", () => {
  const source = readFileSync("scripts/seed/clean-duplicate-spots.mjs", "utf8");

  it("既定では消さない（--apply を付けたときだけ消す）", () => {
    expect(source).toContain('const apply = process.argv.includes("--apply")');
    expect(source).toContain("if (!apply)");
  });

  it("seed のスポットだけを見る（#776: 名前ではなく id の控えで見分ける）", () => {
    expect(source).toContain("seed-ids.json");
    expect(source).toContain("LEGACY_SEED_SPOT_SUFFIX");
  });

  it("同じ名前が 2 つ以上あるときだけ動く", () => {
    expect(source).toContain("rows.length > 1");
  });

  it("投稿が 1 件でもあるスポットは消さない", () => {
    expect(source).toContain("hasPost");
    expect(source).toContain("candidates.filter((spot) => !hasPost.has(spot.id))");
  });

  it("スポットを指している行を先に消す（外部キーで止まらないように）", () => {
    for (const table of ["wishlist", "spot_status_reports", "itinerary_spots"]) {
      expect(source, table).toContain(table);
    }
  });
});


/**
 * #776: seed の印（スポット名の末尾「（seed）」・ユーザー名の先頭「[seed] 」）を画面に出さない。
 *
 * 【初心者向け】印は「どれが seed か」を見分ける唯一の手がかりだった。外すだけだと
 * **消す道具が seed を見つけられなくなる**ので、入れた id を控える仕組みに替えてある。
 * ここでは「印を付け直していないか」と「替えの仕組みが残っているか」を見張る。
 */
describe("seed の印を外した（#776）", () => {
  const seed = readFileSync("scripts/seed/seed-tokyo.mjs", "utf8");
  const strip = readFileSync("scripts/seed/strip-seed-markers.mjs", "utf8");
  const clean = readFileSync("scripts/seed/clean-seed.mjs", "utf8");
  const data = readFileSync("scripts/seed/seed-data.mjs", "utf8");

  it("入れるときに名前へ印を付けない", () => {
    expect(seed).not.toContain("SEED_TAG");
    expect(seed).not.toContain("SEED_SPOT_SUFFIX");
    expect(seed).toContain("name: s.name,");
    expect(seed).toContain("display_name: u.name,");
  });

  it("入れた id を控える（これが消すときの手がかり）", () => {
    expect(seed).toContain("seed-ids.json");
    expect(seed).toContain("spotIds");
    expect(seed).toContain("tripIds");
  });

  it("消す道具は id の控えを使い、名前だけでは選ばない", () => {
    expect(clean).toContain("seed-ids.json");
    // ダミーユーザーは email で見分ける（画面に出ない値）
    expect(clean).toContain("SEED_EMAIL_DOMAIN");
  });

  it("消す道具は既定では消さない（--apply を付けたときだけ）", () => {
    expect(clean).toContain('const apply = process.argv.includes("--apply")');
    expect(clean).toContain("if (!apply)");
  });

  it("印を外す道具は既定では直さない（--apply を付けたときだけ）", () => {
    expect(strip).toContain('const apply = process.argv.includes("--apply")');
    expect(strip).toContain("if (!apply)");
  });

  it("印を外す道具は、外す前に id を控える", () => {
    expect(strip.indexOf("seed-ids.json")).toBeLessThan(strip.indexOf('admin.from("spots").update'));
  });

  it("古い印は「もう付けない」と分かる名前で残してある（既にある行を見つけるため）", () => {
    expect(data).toContain("LEGACY_SEED_TAG");
    expect(data).toContain("LEGACY_SEED_SPOT_SUFFIX");
  });

  it("入れる側と消す側が同じ定義を見ている（二重に書かない）", () => {
    expect(seed).toContain('from "./seed-data.mjs"');
    expect(clean).toContain('from "./seed-data.mjs"');
  });
});
