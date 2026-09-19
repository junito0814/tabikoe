import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { moveItem, useRowDrag } from "./use-row-drag";

/**
 * 出典: docs/tasks/shared-ui/mentoring-7/08-itinerary-detail.md 単体テスト
 * - ドラッグで sort_order が入れ替わること（from → to の並べ替え）
 * 【初心者向け】jsdom は要素の位置を測れない（getBoundingClientRect が全部 0）ので、行ごとに位置を偽装してから
 * 取っ手に pointerdown → pointermove → pointerup を送り、onReorder が正しい from/to で呼ばれることを確かめる。
 */
function List({ onReorder }: { onReorder: (from: number, to: number) => void }) {
  const { registerRow, handleProps, dragging } = useRowDrag(onReorder);
  return (
    <ul data-dragging={dragging ? `${dragging.from}-${dragging.over}` : ""}>
      {["a", "b", "c"].map((id, index) => (
        <li key={id} ref={registerRow(index)} data-row={id}>
          {id}
          <button type="button" {...handleProps(index)} aria-label={`${id} を並べ替え`}>
            ≡
          </button>
        </li>
      ))}
    </ul>
  );
}

function fakeRects() {
  // 各行を高さ 40px で縦に並べたことにする
  document.querySelectorAll("[data-row]").forEach((element, index) => {
    (element as HTMLElement).getBoundingClientRect = () => ({ top: index * 40, height: 40, bottom: index * 40 + 40, left: 0, right: 100, width: 100, x: 0, y: index * 40, toJSON: () => ({}) });
  });
}

describe("useRowDrag", () => {
  it("取っ手を掴んで別の行の位置で離すと onReorder(from, to)", () => {
    const onReorder = vi.fn();
    render(<List onReorder={onReorder} />);
    fakeRects();
    const handle = screen.getByRole("button", { name: "a を並べ替え" });
    handle.setPointerCapture = vi.fn();
    handle.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 20 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 100 }); // c の行の中心
    expect(screen.getByRole("list")).toHaveAttribute("data-dragging", "0-2");
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(onReorder).toHaveBeenCalledWith(0, 2);
  });

  it("同じ位置で離すと呼ばない。↑↓ キーでも 1 つ動く", () => {
    const onReorder = vi.fn();
    render(<List onReorder={onReorder} />);
    fakeRects();
    const handle = screen.getByRole("button", { name: "b を並べ替え" });
    handle.setPointerCapture = vi.fn();
    handle.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 60 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(onReorder).not.toHaveBeenCalled();
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(onReorder).toHaveBeenCalledWith(1, 0);
  });
});

describe("moveItem", () => {
  it("from を to へ動かす（純粋関数）", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
});
