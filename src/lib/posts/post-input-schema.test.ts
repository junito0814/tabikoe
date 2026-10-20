import { describe, expect, it } from "vitest";
import { firstPostError, postFieldsSchema } from "./post-input-schema";
import { validatePostInputOn } from "./validate-post-input";
import { POST_CATEGORIES, POST_DURATIONS } from "./constants";

/**
 * 出典: #993「投稿の入力検証を 1 つのスキーマにまとめる」
 * 方針: 要件定義書 7.2「入力の検証」
 *
 * 【初心者向け】いまの動きを写し取ったテストは validate-post-input.test.ts にあります。
 * こちらは **スキーマにしたから書けるようになったこと** を見ます。
 * いちばん大きいのは「**今日の日付を外から渡せる**」ことで、
 * 実際の日付に関係なく、未来日の判定をいつでも同じ結果で確かめられます。
 */
const BASE = {
  status: "published",
  category: POST_CATEGORIES[0],
  duration: POST_DURATIONS[0],
  rating: 3,
  lat: 35.68,
  lng: 139.76,
} as const;

describe("投稿のスキーマ（#993）", () => {
  it("「今日」を外から受け取る（スキーマの中で現在時刻を読まない）", () => {
    // 同じ入力でも、渡す「今日」次第で通る／断るが変わる＝時計を見ていない証拠
    const input = { ...BASE, visitDate: "2026-06-15" };
    expect(validatePostInputOn(input, "2026-06-15").ok).toBe(true);
    expect(validatePostInputOn(input, "2026-12-31").ok).toBe(true);
    const past = validatePostInputOn(input, "2026-01-01");
    expect(past.ok).toBe(false);
    expect(past.ok ? "" : past.error).toBe("future_visit_date");
  });

  it("通ったあとの形が決まっている（呼び出し側で `as` を書かなくてよい）", () => {
    const result = postFieldsSchema("2026-10-18").safeParse({ ...BASE, cost: "", comment: "よかった" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    // 型だけでなく、値も「API がそのまま DB に渡せる形」になっている
    expect(result.data).toEqual({
      status: "published",
      category: POST_CATEGORIES[0],
      duration: POST_DURATIONS[0],
      visibility: "public",
      rating: 3,
      cost: null,
      visitDate: "2026-10-18",
      comment: "よかった",
      lat: 35.68,
      lng: 139.76,
    });
  });

  it("数値の自動変換をしない（空欄が 0 円にならない）", () => {
    // 【初心者向け】zod には文字列を数値に直す機能がありますが、
    // `""` → 0、`true` → 1 のように通してしまうので使っていません（要件定義書 7.2）
    expect(validatePostInputOn({ ...BASE, cost: "1000" }, "2026-10-18").ok).toBe(false);
    expect(validatePostInputOn({ ...BASE, cost: true }, "2026-10-18").ok).toBe(false);
    expect(validatePostInputOn({ ...BASE, cost: "0x10" }, "2026-10-18").ok).toBe(false);
    // 空欄は 0 ではなく「未入力（null）」として扱う
    const blank = validatePostInputOn({ ...BASE, cost: "" }, "2026-10-18");
    expect(blank.ok && blank.fields.cost).toBeNull();
  });

  it("おかしい値が複数あっても、返すエラーは 1 つ（優先順で選ぶ）", () => {
    expect(firstPostError([{ code: "custom", path: ["cost"], message: "" } as never])).toBe("invalid_cost");
    expect(
      firstPostError([
        { code: "custom", path: ["comment"], message: "" },
        { code: "custom", path: ["category"], message: "" },
      ] as never[]),
    ).toBe("invalid_category");
    // 未来日は、形式のエラーと区別して返す（画面のメッセージが変わるため）
    expect(firstPostError([{ code: "custom", path: ["visitDate"], message: "future_visit_date" } as never])).toBe(
      "future_visit_date",
    );
  });
});
