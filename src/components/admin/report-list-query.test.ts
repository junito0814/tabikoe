import { describe, expect, it } from "vitest";
import { buildReportListParams, EMPTY_REPORT_LIST_STATE, reportListStateFromParams } from "./report-list-query";

/** 出典: docs/tasks/admin/admin-shell-dashboard/02-dashboard-summary.md 単体テスト（ダッシュボードのリンクを通報一覧が受ける） */
describe("reportListStateFromParams（admin-shell-dashboard Task 2）", () => {
  it("ダッシュボードのリンクを初期状態にし、不正な値は空にする", () => {
    expect(reportListStateFromParams(new URLSearchParams({ status: "open", sort: "oldest", target_id: "11111111-2222-3333-4444-555555555555" }))).toEqual({
      status: "open",
      reason: "",
      targetType: "",
      targetId: "11111111-2222-3333-4444-555555555555",
      sort: "oldest",
      from: "",
      to: "",
    });
    expect(reportListStateFromParams(new URLSearchParams({ status: "bogus", target_id: "x", from: "2026-09-01T00:00:00" }))).toMatchObject({ status: "", targetId: undefined, from: "2026-09-01" });
  });

  it("targetId と sort=oldest がクエリに乗る", () => {
    const params = buildReportListParams({ ...EMPTY_REPORT_LIST_STATE, status: "open", targetId: "abc", sort: "oldest" }, 0);
    expect(params.toString()).toBe("status=open&target_id=abc&sort=oldest");
  });
});

/**
 * #1013（2026-10-24）: 「新しい順」が効かなかったバグ。
 *
 * 【初心者向け】原因は「既定と同じ値はクエリに入れない」という書き方でした。
 * #892 で**既定が newest から urgency に変わった**ので、newest を省くと urgency に
 * なってしまいます。3 つの並びすべてが**状態 → クエリ → 状態**で往復することを見張ります。
 */
describe("並びの往復（#1013）", () => {
  it("3 つの並びすべてがクエリに乗り、読み戻せる", () => {
    for (const sort of ["newest", "oldest"] as const) {
      const params = buildReportListParams({ ...EMPTY_REPORT_LIST_STATE, sort }, 0);
      expect(params.get("sort"), sort).toBe(sort);
      expect(reportListStateFromParams(params).sort, sort).toBe(sort);
    }
  });

  it("urgency は既定なのでクエリに入れない（入っていれば読める）", () => {
    expect(buildReportListParams({ ...EMPTY_REPORT_LIST_STATE, sort: "urgency" }, 0).get("sort")).toBeNull();
    expect(reportListStateFromParams(new URLSearchParams({ sort: "urgency" })).sort).toBe("urgency");
  });

  it("知らない値は「指定なし」にする", () => {
    expect(reportListStateFromParams(new URLSearchParams({ sort: "random" })).sort).toBeUndefined();
    expect(reportListStateFromParams(new URLSearchParams()).sort).toBeUndefined();
  });
});
