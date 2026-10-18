import { describe, expect, it } from "vitest";
import { validatePostInput, type PostInput } from "./validate-post-input";
import {
  MAX_POST_COMMENT_LENGTH,
  MAX_POST_COST,
  POST_CATEGORIES,
  POST_DURATIONS,
  todayInJst,
} from "./constants";

/**
 * 出典: #993「投稿の入力検証を 1 つのスキーマにまとめる」の受入条件
 *   「既存の検証のテストを 1 件も書き換えずに、全部通る」
 * 方針: 要件定義書 7.2「入力の検証」
 *
 * 【初心者向け】このテストは **いまの動きを写し取るため** に書いています。
 * 中身を zod のスキーマに作り替えるとき、**このファイルを 1 文字も直さずに通れば**
 * 「外から見た動きは変わっていない」と言えます。逆に通らなければ、
 * 作り替えで挙動を変えてしまった証拠なので、スキーマ側を直します。
 *
 * そのため、ここでは「こうあるべき」ではなく「**いまこうなっている**」を書きます。
 * 直感に反するところ（星 0 が未入力と同じ扱いになる等）にはその旨を注記しています。
 */

/** 公開投稿として通る最小の入力 */
function publishedInput(overrides: PostInput = {}): PostInput {
  return {
    status: "published",
    category: POST_CATEGORIES[0],
    duration: POST_DURATIONS[0],
    rating: 3,
    lat: 35.68,
    lng: 139.76,
    ...overrides,
  };
}

/** 下書きとして通る最小の入力（位置だけ） */
function draftInput(overrides: PostInput = {}): PostInput {
  return { status: "draft", lat: 35.68, lng: 139.76, ...overrides };
}

/** 失敗したときだけ error を取り出す（成功していたらテストを落とす） */
function errorOf(input: PostInput): string {
  const result = validatePostInput(input);
  expect(result.ok, `通ってしまった: ${JSON.stringify(input)}`).toBe(false);
  return result.ok ? "" : result.error;
}

function fieldsOf(input: PostInput) {
  const result = validatePostInput(input);
  expect(result.ok, `断られた: ${JSON.stringify(input)}`).toBe(true);
  if (!result.ok) throw new Error("unreachable");
  return result.fields;
}

describe("投稿の入力検証: 通る形", () => {
  it("公開に必要な項目が揃っていれば通る", () => {
    const fields = fieldsOf(publishedInput());
    expect(fields.status).toBe("published");
    expect(fields.category).toBe(POST_CATEGORIES[0]);
    expect(fields.duration).toBe(POST_DURATIONS[0]);
    expect(fields.rating).toBe(3);
    expect(fields.lat).toBe(35.68);
    expect(fields.lng).toBe(139.76);
  });

  it("下書きは位置だけで通る（ほかは空でよい）", () => {
    const fields = fieldsOf(draftInput());
    expect(fields.status).toBe("draft");
    expect(fields.category).toBeNull();
    expect(fields.duration).toBeNull();
    expect(fields.rating).toBeNull();
    expect(fields.cost).toBeNull();
    expect(fields.visitDate).toBeNull();
    expect(fields.comment).toBeNull();
  });

  it("status を省略すると公開として扱う（v1 からの呼び出し互換）", () => {
    const input = publishedInput();
    delete input.status;
    expect(fieldsOf(input).status).toBe("published");
    expect(fieldsOf(publishedInput({ status: null })).status).toBe("published");
    expect(fieldsOf(publishedInput({ status: "" })).status).toBe("published");
  });

  it("公開設定を省略すると公開（public）になる", () => {
    expect(fieldsOf(publishedInput()).visibility).toBe("public");
    expect(fieldsOf(publishedInput({ visibility: "private" })).visibility).toBe("private");
  });

  it("公開で訪問日を省略すると、今日（JST）が入る", () => {
    expect(fieldsOf(publishedInput()).visitDate).toBe(todayInJst());
    expect(fieldsOf(publishedInput({ visitDate: "" })).visitDate).toBe(todayInJst());
    expect(fieldsOf(publishedInput({ visitDate: null })).visitDate).toBe(todayInJst());
  });

  it("下書きで訪問日を省略すると null のまま（今日を入れない）", () => {
    expect(fieldsOf(draftInput()).visitDate).toBeNull();
  });

  it("訪問日が今日なら通る（当日を含む）", () => {
    expect(fieldsOf(publishedInput({ visitDate: todayInJst() })).visitDate).toBe(todayInJst());
  });

  it("感想は空文字なら null になる", () => {
    expect(fieldsOf(publishedInput({ comment: "" })).comment).toBeNull();
    expect(fieldsOf(publishedInput({ comment: "よかった" })).comment).toBe("よかった");
  });

  it("感想が文字列以外なら、無かったことにする（断らない）", () => {
    expect(fieldsOf(publishedInput({ comment: 123 })).comment).toBeNull();
    expect(fieldsOf(publishedInput({ comment: { a: 1 } })).comment).toBeNull();
  });

  it("費用は未入力なら null。0 は 0 として入る", () => {
    expect(fieldsOf(publishedInput()).cost).toBeNull();
    expect(fieldsOf(publishedInput({ cost: null })).cost).toBeNull();
    expect(fieldsOf(publishedInput({ cost: "" })).cost).toBeNull();
    expect(fieldsOf(publishedInput({ cost: 0 })).cost).toBe(0);
    expect(fieldsOf(publishedInput({ cost: MAX_POST_COST })).cost).toBe(MAX_POST_COST);
  });

  it("位置は範囲の端（±90 / ±180）まで通る", () => {
    expect(fieldsOf(publishedInput({ lat: 90, lng: 180 })).lat).toBe(90);
    expect(fieldsOf(publishedInput({ lat: -90, lng: -180 })).lng).toBe(-180);
  });

  it("知らないキーが混ざっていても、投稿の項目だけを取り出す", () => {
    // 投稿 API は spotId・media など別で使うキーも同じ JSON で受けるため、
    // ここでは余りのキーを無視する（断らない）のが現在の動き
    const fields = fieldsOf(publishedInput({ spotId: "abc", media: [], isAdmin: true } as PostInput));
    expect(Object.keys(fields).sort()).toEqual(
      ["category", "comment", "cost", "duration", "lat", "lng", "rating", "status", "visibility", "visitDate"],
    );
  });
});

describe("投稿の入力検証: 断る形", () => {
  it("知らない状態は断る", () => {
    expect(errorOf(publishedInput({ status: "archived" }))).toBe("invalid_status");
    expect(errorOf(publishedInput({ status: 1 }))).toBe("invalid_status");
  });

  it("位置が無い・数値でない・範囲外なら断る", () => {
    for (const bad of [
      { lat: undefined, lng: 139.76 },
      { lat: 35.68, lng: undefined },
      { lat: "35.68", lng: 139.76 },
      { lat: Number.NaN, lng: 139.76 },
      { lat: Number.POSITIVE_INFINITY, lng: 139.76 },
      { lat: 90.1, lng: 139.76 },
      { lat: -90.1, lng: 139.76 },
      { lat: 35.68, lng: 180.1 },
      { lat: 35.68, lng: -180.1 },
      { lat: null, lng: null },
    ]) {
      expect(errorOf(publishedInput(bad)), JSON.stringify(bad)).toBe("invalid_location");
    }
  });

  it("位置は下書きでも必須", () => {
    const input = draftInput();
    delete input.lat;
    expect(errorOf(input)).toBe("invalid_location");
  });

  it("知らない公開設定は断る", () => {
    expect(errorOf(publishedInput({ visibility: "friends" }))).toBe("invalid_visibility");
  });

  it("公開ではカテゴリ・滞在時間・星が必須", () => {
    expect(errorOf(publishedInput({ category: null }))).toBe("invalid_category");
    expect(errorOf(publishedInput({ duration: null }))).toBe("invalid_duration");
    expect(errorOf(publishedInput({ rating: null }))).toBe("invalid_rating");
  });

  it("選択肢に無いカテゴリ・滞在時間は、下書きでも断る", () => {
    expect(errorOf(draftInput({ category: "謎" }))).toBe("invalid_category");
    expect(errorOf(draftInput({ duration: "3日" }))).toBe("invalid_duration");
    expect(errorOf(draftInput({ category: 1 }))).toBe("invalid_category");
  });

  it("廃止した滞在時間「それ以上」は新しい入力では断る", () => {
    // 既存の投稿には残っているが、入力としては受け付けない（constants.ts の LEGACY_POST_DURATIONS）
    expect(errorOf(draftInput({ duration: "それ以上" }))).toBe("invalid_duration");
  });

  it("星は 1〜5 の整数だけ（0・小数・範囲外は断る）", () => {
    expect(errorOf(publishedInput({ rating: 0 }))).toBe("invalid_rating");
    for (const bad of [6, -1, 3.5, "3", true]) {
      expect(errorOf(draftInput({ rating: bad })), String(bad)).toBe("invalid_rating");
    }
  });

  it("星 0 は「未入力」と同じ扱い（下書きでは通り、null になる）", () => {
    // 画面が「星なし」を 0 で送ってくるため。公開では上のテストのとおり断る
    expect(fieldsOf(draftInput({ rating: 0 })).rating).toBeNull();
  });

  it("費用は 0〜999999 の整数だけ", () => {
    for (const bad of [-1, MAX_POST_COST + 1, 1.5, "100", true, []]) {
      expect(errorOf(draftInput({ cost: bad })), JSON.stringify(bad)).toBe("invalid_cost");
    }
  });

  it("訪問日は YYYY-MM-DD の形だけ", () => {
    for (const bad of ["2026/10/18", "20261018", "2026-1-1", "きょう", "2026-10-18T00:00:00Z"]) {
      expect(errorOf(draftInput({ visitDate: bad })), bad).toBe("invalid_visit_date");
    }
  });

  it("訪問日が文字列でなければ断る", () => {
    for (const bad of [20261018, true, {}, []]) {
      expect(errorOf(draftInput({ visitDate: bad })), JSON.stringify(bad)).toBe("invalid_visit_date");
    }
  });

  it("未来の訪問日は断る（JST 基準）", () => {
    // 日付の足し算は UTC で行う（`toISOString` は UTC なので、JST の真夜中を足すと 1 日ずれる）
    const [y, m, d] = todayInJst().split("-").map(Number);
    const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    expect(errorOf(draftInput({ visitDate: tomorrow }))).toBe("future_visit_date");
  });

  it("感想が上限を超えたら断る（見た目の 1 文字で数える）", () => {
    expect(fieldsOf(draftInput({ comment: "あ".repeat(MAX_POST_COMMENT_LENGTH) }))).toBeTruthy();
    expect(errorOf(draftInput({ comment: "あ".repeat(MAX_POST_COMMENT_LENGTH + 1) }))).toBe("comment_too_long");
  });

  it("絵文字は見た目どおり 1 文字として数える（組み込みの文字数ではない）", () => {
    // 家族の絵文字は JavaScript の length では 11 だが、ここでは 1 と数える。
    // 上限ぴったりまで通ることで、数え方が変わっていないことを確かめる
    const family = "👨‍👩‍👧‍👦";
    expect(family.length).toBeGreaterThan(1);
    const comment = family.repeat(MAX_POST_COMMENT_LENGTH);
    expect(fieldsOf(draftInput({ comment })).comment).toBe(comment);
    expect(errorOf(draftInput({ comment: comment + family }))).toBe("comment_too_long");
  });
});

describe("投稿の入力検証: 複数おかしいときに返す順番", () => {
  /*
   * 【初心者向け】エラーは 1 つだけ返す形なので、**どれを先に返すか**も動きの一部です。
   * 作り替えで順番が変わると、画面に出るメッセージが変わってしまいます。
   */
  it("状態 → 位置 → 公開設定 → カテゴリ → 滞在時間 → 星 → 費用 → 訪問日 → 感想 の順に返す", () => {
    const allBad: PostInput = {
      status: "謎",
      lat: 999,
      lng: 999,
      visibility: "謎",
      category: "謎",
      duration: "謎",
      rating: 9,
      cost: -1,
      visitDate: "謎",
      comment: "あ".repeat(MAX_POST_COMMENT_LENGTH + 1),
    };
    expect(errorOf(allBad)).toBe("invalid_status");
    expect(errorOf({ ...allBad, status: "draft" })).toBe("invalid_location");
    expect(errorOf({ ...allBad, status: "draft", lat: 35.68, lng: 139.76 })).toBe("invalid_visibility");
    expect(errorOf({ ...allBad, status: "draft", lat: 35.68, lng: 139.76, visibility: "public" })).toBe("invalid_category");
    expect(errorOf({ ...allBad, status: "draft", lat: 35.68, lng: 139.76, visibility: "public", category: POST_CATEGORIES[0] })).toBe("invalid_duration");
    expect(errorOf({ ...allBad, status: "draft", lat: 35.68, lng: 139.76, visibility: "public", category: POST_CATEGORIES[0], duration: POST_DURATIONS[0] })).toBe("invalid_rating");
    expect(errorOf({ ...allBad, status: "draft", lat: 35.68, lng: 139.76, visibility: "public", category: POST_CATEGORIES[0], duration: POST_DURATIONS[0], rating: 3 })).toBe("invalid_cost");
    expect(errorOf({ ...allBad, status: "draft", lat: 35.68, lng: 139.76, visibility: "public", category: POST_CATEGORIES[0], duration: POST_DURATIONS[0], rating: 3, cost: 0 })).toBe("invalid_visit_date");
    expect(errorOf({ ...allBad, status: "draft", lat: 35.68, lng: 139.76, visibility: "public", category: POST_CATEGORIES[0], duration: POST_DURATIONS[0], rating: 3, cost: 0, visitDate: null })).toBe("comment_too_long");
  });
});
