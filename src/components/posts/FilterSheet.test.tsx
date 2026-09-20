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

  it("Bug #473: シートは body 直下（上 1/3 地図＋シートの枠の外）に z-50 で出て、メニューバー（z-40）に隠れない。メニューバーは隠さず残す", () => {
    const { container } = render(
      <div className="relative z-10">
        <FilterSheet open value={EMPTY_SEARCH_STATE} hasDistanceCenter={false} onApply={vi.fn()} onClose={vi.fn()} />
      </div>
    );
    const sheet = document.querySelector("[data-filter-sheet]") as HTMLElement;
    expect(sheet).toHaveClass("z-50");
    expect(sheet.parentElement).toBe(document.body);
    // メニューバーは隠さない: バーがあるときはスマホで下 60px（パソコンで左 200px）を空ける
    expect(sheet).toHaveClass("[body:has([data-menu-bar])_&]:bottom-[60px]");
    expect(container.querySelector("[data-filter-sheet]")).toBeNull();
  });

  it("閉じているときは何も描画しない", () => {
    render(<FilterSheet open={false} value={EMPTY_SEARCH_STATE} hasDistanceCenter={false} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(document.querySelector("[data-filter-sheet]")).toBeNull();
  });
});
