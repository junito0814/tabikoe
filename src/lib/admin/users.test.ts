import { describe, expect, it } from "vitest";
import { buildUserListParams, buildUserSearchFilter, escapeLike, parseUserListQuery, quoteFilterValue, userStatusOf } from "./users";

/** 出典: docs/tasks/admin/user-management/01-user-list.md 単体テスト */
const now = new Date("2026-09-27T00:00:00Z");

describe("userStatusOf", () => {
  it("通常／投稿禁止中（期限内）／仮停止／停止 を判定する", () => {
    expect(userStatusOf({ suspendedAt: null, suspensionKind: null, postingRestrictedUntil: null }, now)).toBe("normal");
    expect(userStatusOf({ suspendedAt: null, suspensionKind: null, postingRestrictedUntil: "2026-09-28T00:00:00Z" }, now)).toBe("restricted");
    expect(userStatusOf({ suspendedAt: null, suspensionKind: null, postingRestrictedUntil: "2026-09-26T00:00:00Z" }, now)).toBe("normal");
    expect(userStatusOf({ suspendedAt: "2026-09-26T00:00:00Z", suspensionKind: "provisional", postingRestrictedUntil: null }, now)).toBe("provisional");
    expect(userStatusOf({ suspendedAt: "2026-09-26T00:00:00Z", suspensionKind: "confirmed", postingRestrictedUntil: null }, now)).toBe("suspended");
    // 旧来の停止（suspension_kind が無い）は「停止」
    expect(userStatusOf({ suspendedAt: "2026-09-26T00:00:00Z", suspensionKind: null, postingRestrictedUntil: "2026-09-30T00:00:00Z" }, now)).toBe("suspended");
  });
});

describe("parseUserListQuery / buildUserListParams", () => {
  it("検索・状態・並び・offset を読み、不正な値は既定にする", () => {
    expect(parseUserListQuery(new URLSearchParams({ q: " はな ", status: "provisional", sort: "created", offset: "20" }))).toEqual({
      q: "はな",
      status: "provisional",
      sort: "created",
      offset: 20,
    });
    expect(parseUserListQuery(new URLSearchParams({ status: "x", sort: "y", offset: "-3" }))).toEqual({ q: "", status: null, sort: "last_active", offset: 0 });
  });

  it("既定値はクエリに乗せない", () => {
    expect(buildUserListParams({ q: "", status: null, sort: "last_active", offset: 0 }).toString()).toBe("");
    expect(buildUserListParams({ q: "a@b", status: "suspended", sort: "reported", offset: 20 }).toString()).toBe("q=a%40b&status=suspended&sort=reported&offset=20");
  });

  it("ilike の特殊文字をエスケープする", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

/**
 * #999（2026-10-18）: 記号を含む検索語が、条件文の区切りとして読まれないこと。
 *
 * 【初心者向け】絞り込みは `display_name.ilike.<値>,email.ilike.<値>` という **1 本の文字列**で
 * 送ります。`,` と `.` はその文字列の中で意味を持つので、値に入ったときに
 * **値の一部として読まれる形**（引用符でくくる）になっているかを見ます。
 */
describe("利用者検索の条件文（#999）", () => {
  it("値を引用符でくくる", () => {
    expect(quoteFilterValue("abc")).toBe('"abc"');
  });

  it("引用符と打ち消しには、打ち消しを付けてからくくる", () => {
    // くくりが値の途中で終わってしまわないようにする
    expect(quoteFilterValue('a"b')).toBe('"a\\"b"');
    expect(quoteFilterValue("a\\b")).toBe('"a\\\\b"');
  });

  it("メールアドレス（. を含む）がそのまま値になる", () => {
    expect(buildUserSearchFilter("a@b.example")).toBe(
      'display_name.ilike."%a@b.example%",email.ilike."%a@b.example%"',
    );
  });

  it("区切りに使われる記号を含んでも、条件は 2 つのまま", () => {
    for (const keyword of [",", ".", "(", ")", 'a,b.c(d)', '"', "\\"]) {
      const filter = buildUserSearchFilter(keyword);
      // 引用符の外にある `,` が条件の区切り。くくった中の `,` は数に入らない
      const outsideCommas = filter.replace(/"(?:[^"\\]|\\.)*"/g, "").split(",").length - 1;
      expect(outsideCommas, JSON.stringify(keyword)).toBe(1);
    }
  });

  it("ワイルドカードの打ち消しは残したまま、くくる（順番を間違えない）", () => {
    // `%` は「文字そのもの」として探したいので `\%`。その `\` は引用符の中で `\\` になる
    expect(buildUserSearchFilter("100%")).toBe(
      'display_name.ilike."%100\\\\%%",email.ilike."%100\\\\%%"',
    );
  });
});
