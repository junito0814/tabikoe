import { describe, expect, it } from "vitest";
import { buildUserListParams, escapeLike, parseUserListQuery, userStatusOf } from "./users";

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
