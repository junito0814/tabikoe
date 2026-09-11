import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReportForm } from "./ReportForm";

/**
 * 出典: docs/tasks/safety/reporting/02-report-screen-ui.md 単体テスト
 * - target_type ごとの理由選択肢の出し分け（受入条件20）
 * - 自由記述が1,000文字（書記素単位）を超えると送信ボタンが無効化される
 */
const TARGET_ID = "11111111-2222-4333-8444-555555555555";

function renderForm(targetType: "post" | "user" | "spot", submitReport = vi.fn()) {
  render(
    <ReportForm targetType={targetType} targetId={TARGET_ID} returnTo="/" submitReport={submitReport} />
  );
  return submitReport;
}

describe("ReportForm 理由の出し分け", () => {
  it("投稿の通報では共通6種のみ表示し、なりすまし・スポット情報の誤りは出さない", () => {
    renderForm("post");
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.queryByLabelText("なりすまし")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("スポット情報の誤り")).not.toBeInTheDocument();
  });

  it("ユーザーの通報では「なりすまし」だけが追加される", () => {
    renderForm("user");
    expect(screen.getByLabelText("なりすまし")).toBeInTheDocument();
    expect(screen.queryByLabelText("スポット情報の誤り")).not.toBeInTheDocument();
  });

  it("スポットの通報では「スポット情報の誤り」だけが追加される", () => {
    renderForm("spot");
    expect(screen.getByLabelText("スポット情報の誤り")).toBeInTheDocument();
    expect(screen.queryByLabelText("なりすまし")).not.toBeInTheDocument();
  });
});

describe("ReportForm 送信", () => {
  it("理由を選ぶまで送信ボタンは無効", () => {
    renderForm("post");
    const button = screen.getByRole("button", { name: "通報する" });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByLabelText("スパム・宣伝目的"));
    expect(button).toBeEnabled();
  });

  it("自由記述が1,000文字（書記素）を超えると送信ボタンが無効になる", () => {
    renderForm("post");
    fireEvent.click(screen.getByLabelText("スパム・宣伝目的"));
    const textarea = screen.getByLabelText("詳細（任意）");

    fireEvent.change(textarea, { target: { value: "👨‍👩‍👧".repeat(1000) } });
    expect(screen.getByText("1000 / 1000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "通報する" })).toBeEnabled();

    fireEvent.change(textarea, { target: { value: "👨‍👩‍👧".repeat(1001) } });
    expect(screen.getByRole("button", { name: "通報する" })).toBeDisabled();
  });

  it("送信成功で完了画面を表示する", async () => {
    const submitReport = renderForm(
      "user",
      vi.fn().mockResolvedValue(new Response(null, { status: 201 }))
    );
    fireEvent.click(screen.getByLabelText("なりすまし"));
    fireEvent.click(screen.getByRole("button", { name: "通報する" }));

    await waitFor(() => expect(screen.getByText("通報を受け付けました")).toBeInTheDocument());
    expect(submitReport).toHaveBeenCalledWith({
      targetType: "user",
      targetId: TARGET_ID,
      reason: "impersonation",
      detail: "",
    });
  });

  it("重複通報（409）は「既に通報済み」と表示する", async () => {
    renderForm("post", vi.fn().mockResolvedValue(new Response(null, { status: 409 })));
    fireEvent.click(screen.getByLabelText("その他"));
    fireEvent.click(screen.getByRole("button", { name: "通報する" }));

    await waitFor(() =>
      expect(screen.getByText("この対象は既に通報済みです")).toBeInTheDocument()
    );
  });

  it("上限超過（429）は上限メッセージを表示する", async () => {
    renderForm("post", vi.fn().mockResolvedValue(new Response(null, { status: 429 })));
    fireEvent.click(screen.getByLabelText("その他"));
    fireEvent.click(screen.getByRole("button", { name: "通報する" }));

    await waitFor(() => expect(screen.getByText(/通報の上限/)).toBeInTheDocument());
  });
});
