import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReportDetailScreen } from "./ReportDetailScreen";
import type { ReportDetail } from "@/lib/admin/report-detail";

/**
 * 出典: docs/tasks/admin/report-handling/03-report-action-ui.md 単体テスト
 * - 「削除」操作時に確認ダイアログが表示され、確定操作を経ないとAPIが呼ばれないことを検証する
 */
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const report: ReportDetail = {
  id: "r1",
  reporterId: "reporter",
  targetType: "comment",
  targetId: "c1",
  reason: "spam",
  detail: "宣伝です",
  status: "unconfirmed",
  createdAt: "2026-09-14T00:00:00Z",
  resolvedBy: null,
  resolvedAt: null,
  resolutionNote: null,
  target: { exists: true, summary: "コメント", text: "買ってください", imageUrls: [], ownerId: "bad", hidden: false, href: "/posts/p1" },
};

describe("ReportDetailScreen（SC-18 詳細・対応操作）", () => {
  it("削除は確認ダイアログを経ないと API を呼ばず、キャンセルできる", async () => {
    const submitAction = vi.fn(async () => Response.json({ status: "resolved_deleted" }));
    render(<ReportDetailScreen report={report} submitAction={submitAction} />);
    // strike-system Task 2: 理由が無いと押せないので、先に入れる
    fireEvent.change(screen.getByLabelText(/対応理由/), { target: { value: "スパム" } });
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/復元できません/)).toBeInTheDocument();
    expect(submitAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(submitAction).not.toHaveBeenCalled();
  });

  it("ダイアログで確定すると削除を送る（対応理由付き）", async () => {
    const submitAction = vi.fn(async () => Response.json({ status: "resolved_deleted" }));
    render(<ReportDetailScreen report={report} submitAction={submitAction} />);
    fireEvent.change(screen.getByLabelText(/対応理由/), { target: { value: "スパム" } });
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    await waitFor(() => expect(submitAction).toHaveBeenCalledWith("r1", "delete", "スパム"));
    expect(await screen.findByRole("status")).toHaveTextContent("削除として記録しました");
  });

  it("非公開化・問題なしはダイアログなしで送る", async () => {
    const submitAction = vi.fn(async () => Response.json({ status: "resolved_hidden" }));
    render(<ReportDetailScreen report={report} submitAction={submitAction} />);
    fireEvent.change(screen.getByLabelText(/対応理由/), { target: { value: "不適切" } });
    fireEvent.click(screen.getByRole("button", { name: "非公開化" }));
    await waitFor(() => expect(submitAction).toHaveBeenCalledWith("r1", "hide", "不適切"));
  });

  it("対応済みの通報では操作ボタンが無効", () => {
    render(<ReportDetailScreen report={{ ...report, status: "no_issue" }} submitAction={vi.fn()} />);
    expect(screen.getByRole("button", { name: "削除" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "非公開化" })).toBeDisabled();
  });

  it("strike-system Task 2: 理由が空だと非公開化・削除は押せず、判断の材料（ストライクの予告）が出る", () => {
    render(
      <ReportDetailScreen
        report={report}
        context={{ posterId: "bad", posterName: "はなこ", posterActiveStrikes: 1, nextMeasure: "3日間 投稿・コメント禁止", severe: false, reporter: { noIssueIn90Days: 0, total: 2 }, distinctReporters: 3, autoHideReporters: 3, canRequestSpotFix: false }}
      />
    );
    expect(screen.getByRole("button", { name: "非公開化" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "削除" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "問題なし" })).toBeEnabled();
    expect(screen.getByText(/有効 1 → 2：3日間 投稿・コメント禁止/)).toBeInTheDocument();
    expect(screen.getByText(/直近90日 問題なし 0／全 2 件/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/対応理由/), { target: { value: "電話番号" } });
    expect(screen.getByRole("button", { name: "非公開化" })).toBeEnabled();
  });

  it("strike-system Task 6: スポット情報の誤り（タビコエだけの場所）では主ボタンが「登録者に修正を依頼する」になり、削除は出ない", async () => {
    const submitSpotFixRequest = vi.fn(async () => Response.json({ ok: true, status: "in_review" }));
    render(
      <ReportDetailScreen
        report={{ ...report, targetType: "spot", reason: "wrong_spot_info", target: { ...report.target, ownerId: null, summary: "スポット: 路地裏の喫茶店" } }}
        context={{ posterId: null, posterName: null, posterActiveStrikes: 0, nextMeasure: "警告", severe: false, reporter: { noIssueIn90Days: 0, total: 1 }, distinctReporters: 1, autoHideReporters: 3, canRequestSpotFix: true }}
        submitSpotFixRequest={submitSpotFixRequest}
      />
    );
    expect(screen.queryByRole("button", { name: "削除" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "スポットを非公開化する" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/対応理由/), { target: { value: "住所の確認をお願いします" } });
    fireEvent.click(screen.getByRole("button", { name: "登録者に修正を依頼する" }));
    await waitFor(() => expect(submitSpotFixRequest).toHaveBeenCalledWith("r1", "住所の確認をお願いします"));
    expect(await screen.findByRole("status")).toHaveTextContent("登録者に修正を依頼しました");
  });
});
