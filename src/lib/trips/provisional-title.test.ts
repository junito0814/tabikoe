/**
 * 出典: docs/tasks/posts/trip-title-v3/02-provisional-title.md（単体テスト）
 * 「空タイトルで「今日の投稿（9/16）」が生成され、同日の 2 回目が同じ trip_id を返すこと」（生成部分）
 */
import { describe, expect, it } from "vitest";
import { isProvisionalTripTitle, provisionalTripTitle } from "./provisional-title";

describe("provisionalTripTitle", () => {
  it("JST の日付で「今日の投稿（M/D）」を返す", () => {
    // 2026-09-16 15:30 UTC = 9/17 0:30 JST
    expect(provisionalTripTitle(new Date("2026-09-16T15:30:00Z"))).toBe("今日の投稿（9/17）");
    expect(provisionalTripTitle(new Date("2026-09-16T14:30:00Z"))).toBe("今日の投稿（9/16）");
  });
  it("同じ日なら同じ文字列（＝同じ旅行に入る）", () => {
    expect(provisionalTripTitle(new Date("2026-09-16T01:00:00Z"))).toBe(provisionalTripTitle(new Date("2026-09-16T10:00:00Z")));
  });
});

describe("isProvisionalTripTitle", () => {
  it("仮タイトルの形式だけを真にする", () => {
    expect(isProvisionalTripTitle("今日の投稿（9/16）")).toBe(true);
    expect(isProvisionalTripTitle("大阪旅行")).toBe(false);
  });
});
