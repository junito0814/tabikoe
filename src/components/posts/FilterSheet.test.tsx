import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FilterSheet } from "./FilterSheet";
import { EMPTY_SEARCH_STATE } from "./post-search-query";

/**
 * 出典: docs/tasks/map-search/post-timeline/02-timeline-ui.md（絞り込みシート）
 * - 「この条件で表示」で編集中の条件が親に渡る
 * - Bug #473: シートはメニューバー（z-40）より上（z-50）に出て、下端のボタンが隠れない
 */
describe("FilterSheet（絞り込みシート）", () => {
  it("カテゴリを選んで「この条件で表示」を押すと、その条件が onApply に渡る", () => {
    const onApply = vi.fn();
    render(<FilterSheet open value={EMPTY_SEARCH_STATE} hasDistanceCenter={false} onApply={onApply} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("グルメ"));
    fireEvent.click(screen.getByRole("button", { name: "この条件で表示" }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ categories: ["グルメ"] }));
  });

  it("Bug #473: シートはメニューバー（z-40）より上の z-50 に出る", () => {
    render(<FilterSheet open value={EMPTY_SEARCH_STATE} hasDistanceCenter={false} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(document.querySelector("[data-filter-sheet]")).toHaveClass("z-50");
  });

  it("閉じているときは何も描画しない", () => {
    render(<FilterSheet open={false} value={EMPTY_SEARCH_STATE} hasDistanceCenter={false} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(document.querySelector("[data-filter-sheet]")).toBeNull();
  });
});
