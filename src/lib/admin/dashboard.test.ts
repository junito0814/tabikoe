import { describe, expect, it } from "vitest";
import { daysSince, groupConcentratedTargets, startOfDayJst, startOfWeekJst } from "./dashboard";

/** 出典: docs/tasks/admin/admin-shell-dashboard/02-dashboard-summary.md 単体テスト */
describe("今週・今日（日本時間）", () => {
  it("今週の月曜 0 時（JST）を返す。日曜でも前の月曜", () => {
    // 2026-09-27 は日曜。JST 10:00
    expect(startOfWeekJst(new Date("2026-09-27T01:00:00Z")).toISOString()).toBe("2026-09-20T15:00:00.000Z"); // 9/21 月 0:00 JST
    // 月曜の JST 0:30（UTC では日曜 15:30）は その月曜
    expect(startOfWeekJst(new Date("2026-09-20T15:30:00Z")).toISOString()).toBe("2026-09-20T15:00:00.000Z");
  });

  it("今日の 0 時（JST）を返す", () => {
    expect(startOfDayJst(new Date("2026-09-27T01:00:00Z")).toISOString()).toBe("2026-09-26T15:00:00.000Z");
  });

  it("経過日数は切り捨て、未来は 0", () => {
    const now = new Date("2026-09-27T00:00:00Z");
    expect(daysSince("2026-09-21T12:00:00Z", now)).toBe(5);
    expect(daysSince("2026-09-28T00:00:00Z", now)).toBe(0);
  });
});

describe("通報が集中している対象", () => {
  it("異なる通報者の数で並び、同じ人の重複は 1 人。同数なら新しい順", () => {
    const rows = [
      { targetType: "post" as const, targetId: "p1", reporterId: "a", createdAt: "2026-09-25T00:00:00Z" },
      { targetType: "post" as const, targetId: "p1", reporterId: "a", createdAt: "2026-09-26T00:00:00Z" },
      { targetType: "post" as const, targetId: "p1", reporterId: "b", createdAt: "2026-09-24T00:00:00Z" },
      { targetType: "user" as const, targetId: "u1", reporterId: "c", createdAt: "2026-09-26T12:00:00Z" },
      { targetType: "user" as const, targetId: "u1", reporterId: "d", createdAt: "2026-09-20T00:00:00Z" },
      { targetType: "comment" as const, targetId: "c1", reporterId: "e", createdAt: "2026-09-27T00:00:00Z" },
    ];
    const result = groupConcentratedTargets(rows, new Map([["post:p1", "たこ焼き〇〇の投稿"]]));
    expect(result.map((r) => [r.targetId, r.reporterCount])).toEqual([
      ["u1", 2],
      ["p1", 2],
      ["c1", 1],
    ]);
    expect(result[1].label).toBe("たこ焼き〇〇の投稿");
    expect(result[1].latestAt).toBe("2026-09-26T00:00:00Z");
    expect(result[2].label).toBe("コメント c1");
    expect(result[0].href).toBe("/admin/reports?status=open&target_type=user&target_id=u1");
  });

  it("limit で件数を絞る", () => {
    const rows = ["a", "b", "c"].map((id) => ({ targetType: "post" as const, targetId: id, reporterId: "x", createdAt: "2026-09-01T00:00:00Z" }));
    expect(groupConcentratedTargets(rows, new Map(), 2)).toHaveLength(2);
  });
});
