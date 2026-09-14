import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReportListScreen } from "./ReportListScreen";
import { buildReportListParams } from "./report-list-query";

/**
 * 出典: docs/tasks/admin/report-list/02-report-list-ui.md 単体テスト
 * - 絞り込み条件のUI操作が、Task1のAPIへ正しいクエリパラメータで反映されることを検証する
 */
const empty = { reports: [], nextOffset: null };

describe("buildReportListParams", () => {
  it("選択した条件だけを載せ、日付は当日の範囲に広げる", () => {
    const params = buildReportListParams(
      { status: "unconfirmed", reason: "spam", targetType: "comment", from: "2026-09-01", to: "2026-09-14" },
      50
    );
    expect(Object.fromEntries(params)).toEqual({
      status: "unconfirmed",
      reason: "spam",
      target_type: "comment",
      from: "2026-09-01T00:00:00",
      to: "2026-09-14T23:59:59.999",
      offset: "50",
    });
  });
});

describe("ReportListScreen（SC-18 一覧）", () => {
  it("絞り込みUIの操作がクエリパラメータに反映される", async () => {
    const fetchReports = vi.fn<(params: URLSearchParams) => Promise<typeof empty>>(async () => empty);
    render(<ReportListScreen initialPage={empty} fetchReports={fetchReports} />);
    fireEvent.change(screen.getByLabelText("対応状態"), { target: { value: "in_review" } });
    fireEvent.change(screen.getByLabelText("通報理由"), { target: { value: "inappropriate" } });
    fireEvent.change(screen.getByLabelText("対象種別"), { target: { value: "post" } });
    fireEvent.change(screen.getByLabelText("通報日（から）"), { target: { value: "2026-09-01" } });
    fireEvent.click(screen.getByRole("button", { name: "絞り込む" }));
    await waitFor(() => expect(fetchReports).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(fetchReports.mock.calls[0][0])).toEqual({
      status: "in_review",
      reason: "inappropriate",
      target_type: "post",
      from: "2026-09-01T00:00:00",
    });
  });

  it("各行は通報詳細へのリンク", () => {
    render(
      <ReportListScreen
        initialPage={{
          reports: [
            { id: "r1", targetType: "post", targetId: "p1", reason: "spam", detail: null, status: "unconfirmed", createdAt: "2026-09-14T00:00:00Z", resolvedAt: null, resolutionNote: null },
          ],
          nextOffset: null,
        }}
        fetchReports={vi.fn()}
      />
    );
    expect(document.querySelector("[data-report='r1']")).toHaveAttribute("href", "/admin/reports/r1");
  });
});
