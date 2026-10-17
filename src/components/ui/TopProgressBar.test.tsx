import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopProgressBar } from "./TopProgressBar";

/**
 * 出典: Issue #940、要件定義書 4.5.11
 * - 画面の上端に細いバー。点数が進むと伸びる
 * - まだ総数が分からないときは「流れる」表示（止まって見えないことがこのバーの役目）
 * - 読み上げのための印（role・aria-label・aria-valuenow）を付ける
 */
describe("TopProgressBar（#940）", () => {
  it("上端に出て、読み上げの印が付いている", () => {
    render(<TopProgressBar progress={{ done: 1, total: 4 }} />);
    const bar = screen.getByRole("progressbar", { name: "投稿の進み具合" });
    expect(bar).toHaveClass("fixed", "top-0");
    expect(bar).toHaveAttribute("aria-valuenow", "25");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("点数が進むと幅が伸びる", () => {
    const { rerender } = render(<TopProgressBar progress={{ done: 1, total: 4 }} />);
    const width = () => (screen.getByRole("progressbar").firstElementChild as HTMLElement).style.width;
    expect(width()).toBe("25%");
    rerender(<TopProgressBar progress={{ done: 3, total: 4 }} />);
    expect(width()).toBe("75%");
  });

  it("総数が分からないときは「流れる」表示にし、0% とは読み上げない", () => {
    render(<TopProgressBar progress={null} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).not.toHaveAttribute("aria-valuenow");
    // 動きを減らす設定の人には流さない（motion-safe:）
    expect(bar.firstElementChild).toHaveClass("motion-safe:animate-[top-progress-slide_1.2s_ease-in-out_infinite]");
  });

  it("下書きの保存では読み上げる名前が変わる", () => {
    render(<TopProgressBar progress={null} label="下書きの保存の進み具合" />);
    expect(screen.getByRole("progressbar", { name: "下書きの保存の進み具合" })).toBeInTheDocument();
  });
});
