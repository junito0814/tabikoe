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
