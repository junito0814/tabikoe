import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FilterButton } from "./FilterButton";

/**
 * #811（2026-10-06）: 絞り込みを開くボタンを 3 本線の記号＋効いている数にそろえる
 * 出典: 要件定義書 4.5.15（言葉と記号の統一）
 */
describe("FilterButton（#811）", () => {
  it("読み上げの名前は「絞り込み」（記号だけでも意味が伝わるように）", () => {
    render(<FilterButton count={0} onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "絞り込み" })).toBeInTheDocument();
  });

  it("条件が 0 件なら数の印を出さない", () => {
    const { container } = render(<FilterButton count={0} onClick={() => {}} />);
    expect(container.textContent?.trim()).toBe("");
  });

  it("条件が効いていれば数を出す", () => {
    render(<FilterButton count={3} onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "絞り込み" })).toHaveTextContent("3");
  });

  it("押すと開く", () => {
    const onClick = vi.fn();
    render(<FilterButton count={0} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "絞り込み" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("的は 32px 以上（h-8 w-8。4.5.13 の決まり）", () => {
    render(<FilterButton count={0} onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "絞り込み" }).className).toMatch(/h-8 w-8/);
  });
});
