import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Sheet } from "./Sheet";

/**
 * 出典: docs/wireframes.md（保存先シート・期間の変更などの共通シート）
 * - 背景のタップと Esc で閉じる
 * - Bug #473: メニューバー（z-40）より上の z-50 に出て、フッターのボタンが隠れない
 */
describe("Sheet（共通シート）", () => {
  it("背景のタップと Esc で閉じる。footer を出す", () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="保存先" onClose={onClose} footer={<button type="button">決定</button>}>
        中身
      </Sheet>
    );
    expect(screen.getByRole("dialog", { name: "保存先" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "決定" })).toBeInTheDocument();
    // #804 で取っ手（aria-label「閉じる」）が増えたので、右上の × を名指しで押す
    fireEvent.click(document.querySelector("[data-close-button]") as HTMLElement);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("Bug #473: シートは body 直下（上 1/3 地図＋シートの枠の外）に z-50 で出て、メニューバー（z-40）に隠れない。メニューバーは隠さず残す", () => {
    const { container } = render(
      <div className="relative z-10">
        <Sheet open title="保存先" onClose={vi.fn()}>
          中身
        </Sheet>
      </div>
    );
    const sheet = document.querySelector("[data-sheet]") as HTMLElement;
    expect(sheet).toHaveClass("z-50");
    expect(sheet.parentElement).toBe(document.body);
    // メニューバーは隠さない: バーがあるときはスマホで下 60px（パソコンで左 200px）を空ける
    expect(sheet).toHaveClass("[body:has([data-menu-bar])_&]:bottom-[60px]");
    expect(container.querySelector("[data-sheet]")).toBeNull();
  });
});

/**
 * #804（2026-10-06）: 取っ手を下に引いて閉じる
 * 出典: Issue #804「シートに取っ手を付け、下に引いて閉じられるようにする」
 */
describe("シートの取っ手（#804）", () => {
  const pull = (distance: number) => {
    const handle = document.querySelector("[data-sheet-pull-handle]") as HTMLElement;
    act(() => {
      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 100 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientY: 100 + distance });
      fireEvent.pointerUp(handle, { pointerId: 1, clientY: 100 + distance });
    });
  };

  it("すべてのシートの上に棒が出る（掴める範囲は 32px 以上）", () => {
    render(
      <Sheet open title="保存先" onClose={vi.fn()}>
        中身
      </Sheet>
    );
    const handle = document.querySelector("[data-sheet-pull-handle]") as HTMLElement;
    expect(handle).toBeInTheDocument();
    expect(handle.className).toContain("h-8");
  });

  it("下に 80px 以上引くと閉じる", () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="保存先" onClose={onClose}>
        中身
      </Sheet>
    );
    pull(90);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("途中で戻すと閉じない", () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="保存先" onClose={onClose}>
        中身
      </Sheet>
    );
    pull(40);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("上に引いても閉じない", () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="保存先" onClose={onClose}>
        中身
      </Sheet>
    );
    pull(-120);
    expect(onClose).not.toHaveBeenCalled();
  });
});

/**
 * #796（2026-10-06）: Android の戻るキーでシートだけ閉じる
 * 出典: Issue #796「Bug 4: Android の戻るキーでシートが閉じず、画面ごと戻る」
 */
describe("戻るキーでシートだけ閉じる（#796）", () => {
  let pushState: ReturnType<typeof vi.spyOn>;
  let back: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    pushState = vi.spyOn(window.history, "pushState").mockImplementation(() => {});
    back = vi.spyOn(window.history, "back").mockImplementation(() => {});
  });

  afterEach(() => {
    pushState.mockRestore();
    back.mockRestore();
  });

  it("開くと履歴を 1 つ積み、戻るキーで閉じる（画面はそのまま）", () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="保存先" onClose={onClose}>
        中身
      </Sheet>
    );
    expect(pushState).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
  });

  it("× で閉じたら積んだ分を戻す（履歴が二重に残らない）", () => {
    const { rerender } = render(
      <Sheet open title="保存先" onClose={vi.fn()}>
        中身
      </Sheet>
    );
    rerender(
      <Sheet open={false} title="保存先" onClose={vi.fn()}>
        中身
      </Sheet>
    );
    expect(back).toHaveBeenCalledTimes(1);
  });
});
