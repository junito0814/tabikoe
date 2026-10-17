import { describe, expect, it } from "vitest";
import { isGuestReadableSearch } from "./guest-read";

/**
 * 出典: Issue #951、要件定義書 3.5.4「公開範囲」
 *
 * 共有リンクで開けるのは **1 つのスポット**の投稿だけ。都道府県や駅での検索結果は
 * 未ログインでは出さない（出すとサービス全体が読めてしまう）。
 */
describe("isGuestReadableSearch（#951）", () => {
  it("spot=<id> があれば読んでよい（SC-04 とその写真タブ）", () => {
    expect(isGuestReadableSearch(new URLSearchParams("spot=s1"))).toBe(true);
    expect(isGuestReadableSearch(new URLSearchParams("spot=s1&view=photos&sort=rating"))).toBe(true);
  });

  it("行き先が違えば読ませない（検索結果はログインが要る）", () => {
    expect(isGuestReadableSearch(new URLSearchParams("pref=東京都"))).toBe(false);
    expect(isGuestReadableSearch(new URLSearchParams("lat=35.6&lng=139.7"))).toBe(false);
    expect(isGuestReadableSearch(new URLSearchParams())).toBe(false);
  });

  it("空の spot= は行き先として成り立たないので読ませない", () => {
    expect(isGuestReadableSearch(new URLSearchParams("spot="))).toBe(false);
  });
});
