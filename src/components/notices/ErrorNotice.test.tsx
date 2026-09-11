import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ErrorNotice } from "./ErrorNotice";
import { UploadNotice } from "./UploadNotice";

/**
 * 出典: docs/tasks/shared-ui/error-display/01-error-notice-component.md 単体テスト
 */
describe("ErrorNotice", () => {
  it("メッセージ文言がpropsに応じて表示される", () => {
    render(<ErrorNotice message="地図を読み込めませんでした" />);
    expect(screen.getByText("地図を読み込めませんでした")).toBeInTheDocument();
  });

  it("既定では再読み込みボタンを表示しない", () => {
    render(<ErrorNotice message="エラー" />);
    expect(screen.queryByRole("button", { name: "再読み込み" })).not.toBeInTheDocument();
  });

  it("onRetryを渡すと再読み込みボタンが表示される", () => {
    render(<ErrorNotice message="エラー" onRetry={() => {}} />);
    expect(screen.getByRole("button", { name: "再読み込み" })).toBeInTheDocument();
  });

  it("retryableでも再読み込みボタンが表示される（Server Componentから関数を渡せない場合用）", () => {
    render(<ErrorNotice message="エラー" retryable />);
    expect(screen.getByRole("button", { name: "再読み込み" })).toBeInTheDocument();
  });

  it("再読み込みボタン押下で指定のコールバックが呼ばれる", () => {
    const onRetry = vi.fn();
    render(<ErrorNotice message="エラー" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

/**
 * 出典: docs/tasks/shared-ui/upload-notice/01-notice-display.md 単体テスト
 * 「コンポーネントが規定の2つの注意文をレンダリングすること」（要件定義書4.5.2）
 */
describe("UploadNotice", () => {
  it("規定の2つの注意文を表示する", () => {
    render(<UploadNotice />);
    expect(
      screen.getByText("他人が写り込んだ写真・動画は、本人の同意を得てから投稿してください")
    ).toBeInTheDocument();
    expect(
      screen.getByText("個人が特定できる情報（車のナンバー等）が写っていないか確認してください")
    ).toBeInTheDocument();
  });
});
