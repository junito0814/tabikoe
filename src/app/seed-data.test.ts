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
  license: string;
  checkedBy: string;
  note: string;
  photos: { file: string; spot: string; order: number; pixabayId: number; url: string; page: string; tags: string }[];
};

describe("seed の写真（#703）", () => {
  it("全部 Pixabay から取っている", () => {
    expect(photos.photos.length).toBeGreaterThan(0);
    for (const photo of photos.photos) {
      // 大きいほうの URL（largeImageURL）は cdn. が付かず pixabay.com/get/... になる。どちらも Pixabay
      expect(photo.url, photo.file).toMatch(/^https:\/\/(cdn\.)?pixabay\.com\//);
      expect(photo.page, photo.file).toMatch(/^https:\/\/pixabay\.com\//);
    }
  });

  it("取得元・取得日・目で見た記録が残っている", () => {
    expect(photos.source).toContain("Pixabay");
    expect(photos.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(photos.checkedBy).toContain("目で見た");
  });

  it("ライセンスと「どう選んだか」が残っている", () => {
    expect(photos.license).toContain("Pixabay Content License");
    // 人が主題のものを外した、という決まりが残っていること（#893 で外した写真は checkedBy にまとめた）
    expect(photos.license).toContain("人物が主題");
    expect(photos.checkedBy).toContain("外した");
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


/**
 * ~~#777: 1 投稿 1 枚・合う写真が無ければ付けない~~ → **2026-10-07 に廃止**（#893）。
 * 写真が 16 枚しか無かったため、**76 投稿のうち 62 件に写真が付かない**状態になり、
 * 提出用のデータとして成立しなかった。いまは**スポット 51 件すべてに写真を用意**し、
 * 投稿が 1 件だけのスポットではその写真を**全部**載せる（＝複数枚の投稿になる）。
 *
 * 【初心者向け】写真が場所に合っているかは、やはり目で見るしかない
 * （機械には「これが高尾山らしいか」は分からない）。ここで見張るのは**抜けと重なり**:
 *   - どのスポットにも写真と感想が用意されているか（打ち間違いで結び付かないのを防ぐ）
 *   - 同じ写真・同じ感想が 2 か所に出ていないか
 *   - 「写真が付かない投稿が出る」書き方に戻っていないか
 */
describe("seed の写真と感想（#893）", () => {
  const seedSource = readFileSync("scripts/seed/seed-tokyo.mjs", "utf8");
  const seedData = readFileSync("scripts/seed/seed-data.mjs", "utf8");
  const spotNames = [...seedData.matchAll(/^  \{ name: "([^"]+)"/gm)].map((m) => m[1]);

  it("seed にスポットがある（読み取りに失敗していない）", () => {
    expect(spotNames.length).toBeGreaterThan(40);
  });

  it("どのスポットにも写真が 1 枚以上ある", () => {
    const withPhoto = new Set(photos.photos.map((photo) => photo.spot));
    const missing = spotNames.filter((name) => !withPhoto.has(name));
    expect(missing, `写真が無いスポット: ${missing.join("・")}`).toEqual([]);
  });

  it("写真に書いてあるスポット名が本当に seed にある（打ち間違い防止）", () => {
    for (const photo of photos.photos) {
      expect(spotNames, `${photo.file} の spot「${photo.spot}」`).toContain(photo.spot);
    }
  });

  it("同じ写真を 2 か所で使っていない", () => {
    const ids = photos.photos.map((photo) => photo.pixabayId);
    expect(new Set(ids).size, "同じ Pixabay の写真が 2 回出ている").toBe(ids.length);
  });

  it("どのスポットにも感想が 1 件以上用意されている", () => {
    const written = [...seedData.matchAll(/^  "([^"]+)": \[/gm)].map((m) => m[1]);
    const missing = spotNames.filter((name) => !written.includes(name));
    expect(missing, `感想が無いスポット: ${missing.join("・")}`).toEqual([]);
    const extra = written.filter((name) => !spotNames.includes(name));
    expect(extra, `SPOTS に無いスポットの感想: ${extra.join("・")}`).toEqual([]);
  });

  it("同じ感想を 2 回使っていない（以前は同じ文が 13 回出ていた）", () => {
    const comments = [...seedData.matchAll(/\{ c: "([^"]+)"/g)].map((m) => m[1]);
    expect(comments.length).toBeGreaterThan(50);
    const seen = new Set<string>();
    const dupes = comments.filter((c) => (seen.has(c) ? true : (seen.add(c), false)));
    expect(dupes, `重なっている感想: ${dupes.join(" / ")}`).toEqual([]);
  });

  it("感想が空のものがない", () => {
    const entries = [...seedData.matchAll(/\{ c: "([^"]*)", cost: (-?\d+), r: (\d)/g)];
    expect(entries.length).toBeGreaterThan(50);
    for (const [, comment, cost, rating] of entries) {
      expect(comment.trim().length).toBeGreaterThan(10);
      expect(Number(cost)).toBeGreaterThanOrEqual(0);
      expect(Number(rating)).toBeGreaterThanOrEqual(1);
      expect(Number(rating)).toBeLessThanOrEqual(5);
    }
  });

  it("写真が 0 枚の公開投稿ができたら、入れる前に止まる", () => {
    expect(seedSource).toContain("写真が付いていない公開投稿が");
    expect(seedSource).toContain("throw new Error");
  });

  it("投稿が 1 件だけのスポットは写真を全部載せる（複数枚の投稿になる）", () => {
    expect(seedSource).toContain("PHOTOS_BY_SPOT");
    expect(seedSource).toContain("queue.splice(0, queue.length)");
    // 1 投稿 1 枚に戻っていないこと
    expect(seedSource).not.toContain("PHOTO_BY_SPOT.get");
    expect(seedSource).not.toContain("usedPhotos");
  });

  it("写真は全部 Storage に入れる（使わない写真を省く書き方に戻っていない）", () => {
    expect(seedSource).toContain("for (const photo of PHOTOS.photos)");
    expect(seedSource).not.toContain("USABLE_PHOTOS");
  });

  it("感想は 1 か所（seed-data.mjs）にあり、スクリプト側に使い回しの配列が無い", () => {
    expect(seedSource).toContain("SPOT_POSTS");
    expect(seedSource).not.toContain("const COMMENTS = [");
  });
});

/**
 * #893: 動作確認で作って残ってしまった行を消す道具。
 * 名前で消すので、**消す前に必ず一覧を出す**ことと、**--apply を付けたときだけ消す**ことを見張る。
 */
describe("動作確認の残りを消す道具（#893）", () => {
  const source = readFileSync("scripts/seed/clean-test-leftovers.mjs", "utf8");

  it("既定では消さない（--apply を付けたときだけ）", () => {
    expect(source).toContain('const apply = process.argv.includes("--apply")');
  });

  it("消す対象は決め打ちで、名前の一覧がソースに書いてある", () => {
    expect(source).toContain("JUNK_SPOT_NAMES");
    expect(source).toContain("JUNK_TRIP_TITLES");
  });

  it("利用者のアカウントそのものは消さない（投稿だけ）", () => {
    expect(source).not.toContain("auth.admin.deleteUser");
    expect(source).not.toContain('from("users").delete');
  });

  it("seed の写真（seed/）は触らない（あちらは clean-seed.mjs の持ち物）", () => {
    expect(source).toContain('!p.startsWith("seed/")');
  });

  it("スポットを指している行を先に消す（外部キーで止まらないように）", () => {
    for (const table of ["wishlist", "spot_status_reports", "itinerary_spots"]) {
      expect(source, table).toContain(table);
    }
  });
});
