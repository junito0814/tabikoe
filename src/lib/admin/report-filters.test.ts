import { describe, expect, it } from "vitest";
import { buildReportWhereClauses, parseReportFilters, parseSort } from "./report-filters";

/**
 * 出典: docs/tasks/admin/report-list/01-report-list-handler.md 単体テスト
 * - 対応状態・通報理由・対象種別・日時の各絞り込み条件が正しくクエリに反映されることを検証する
 * - 複数条件を組み合わせた絞り込みが正しく動作することを検証する
 */
describe("parseReportFilters / buildReportWhereClauses", () => {
  it("対応状態の絞り込み", () => {
    const filters = parseReportFilters(new URLSearchParams({ status: "unconfirmed" }));
    expect(buildReportWhereClauses(filters)).toEqual([{ op: "eq", column: "status", value: "unconfirmed" }]);
  });

  it("通報理由・対象種別の絞り込み", () => {
    expect(buildReportWhereClauses(parseReportFilters(new URLSearchParams({ reason: "spam" })))).toEqual([
      { op: "eq", column: "reason", value: "spam" },
    ]);
    expect(buildReportWhereClauses(parseReportFilters(new URLSearchParams({ target_type: "comment" })))).toEqual([
      { op: "eq", column: "target_type", value: "comment" },
    ]);
  });

  it("通報日時の範囲", () => {
    const filters = parseReportFilters(new URLSearchParams({ from: "2026-09-01T00:00:00Z", to: "2026-09-30T23:59:59Z" }));
    expect(buildReportWhereClauses(filters)).toEqual([
      { op: "gte", column: "created_at", value: "2026-09-01T00:00:00.000Z" },
      { op: "lte", column: "created_at", value: "2026-09-30T23:59:59.000Z" },
    ]);
  });

  it("複数条件を組み合わせると全条件が AND で並ぶ", () => {
    const filters = parseReportFilters(
      new URLSearchParams({ status: "in_review", reason: "inappropriate", target_type: "post", from: "2026-09-01" })
    );
    expect(buildReportWhereClauses(filters)).toEqual([
      { op: "eq", column: "status", value: "in_review" },
      { op: "eq", column: "reason", value: "inappropriate" },
      { op: "eq", column: "target_type", value: "post" },
      { op: "gte", column: "created_at", value: new Date("2026-09-01").toISOString() },
    ]);
  });

  it("不正な値は無視される（条件なし）", () => {
    const filters = parseReportFilters(new URLSearchParams({ status: "bogus", reason: "x", target_type: "y", from: "not-date" }));
    expect(buildReportWhereClauses(filters)).toEqual([]);
  });
});

describe("admin-shell-dashboard Task 2: 未対応のまとめ・対象・並び", () => {
  it("status=open は未確認＋確認中の in 条件になり、target_id と sort=oldest を読む", () => {
    const filters = parseReportFilters(new URLSearchParams({ status: "open", target_id: "11111111-2222-3333-4444-555555555555", sort: "oldest" }));
    expect(filters.sort).toBe("oldest");
    // 「古い順」は残す。ダッシュボードの「古い通報を放置しない」導線が使う
    expect(buildReportWhereClauses(filters)).toEqual([
      { op: "in", column: "status", values: ["unconfirmed", "in_review"] },
      { op: "eq", column: "target_id", value: "11111111-2222-3333-4444-555555555555" },
    ]);
    /*
     * #892（2026-10-11・決定事項 89）: 既定は **urgency**（Jev の緊急度が高い順）に変えた。
     * 知らない値（"y"）も既定に倒す。
     */
    expect(parseReportFilters(new URLSearchParams({ target_id: "x", sort: "y" }))).toMatchObject({ targetId: null, sort: "urgency" });
  });
});

/**
 * #892 / 決定事項 89（2026-10-11）: 並び順の読み取り。
 *
 * 【初心者向け】URL のクエリは**利用者が自由に書き換えられます**。
 * 知らない値が来ても落ちず、**既定に倒す**ことを見張ります。
 */
describe("parseSort（#892）", () => {
  it("既定は緊急度が高い順", () => {
    expect(parseSort(null)).toBe("urgency");
    expect(parseSort("")).toBe("urgency");
    expect(parseSort("とつぜんの文字列")).toBe("urgency");
  });

  it("古い順・新しい順も選べる", () => {
    expect(parseSort("oldest")).toBe("oldest");
    expect(parseSort("newest")).toBe("newest");
    expect(parseSort("urgency")).toBe("urgency");
  });
});
